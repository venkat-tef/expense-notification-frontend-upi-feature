import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  AfterViewInit,
  ViewChild,
} from '@angular/core';

/**
 * Renders a "side-by-side" video (left half = RGB color, right half = grayscale
 * alpha mask) as a truly transparent, looping avatar animation.
 *
 * PERFORMANCE NOTE (v2): The original version composited frames on the CPU via
 * canvas getImageData/putImageData in a JS pixel loop. That forces a GPU→CPU
 * readback every frame, which is slow — especially on mobile — and was the
 * cause of the stuttering/pausing. This version does the compositing entirely
 * on the GPU with a small WebGL shader instead: upload the video frame as a
 * texture, sample the left half for color and the right half for alpha, done.
 * No pixel loop, no readback, dramatically less main-thread work per frame.
 *
 * It also uses `requestVideoFrameCallback` (falls back to requestAnimationFrame
 * on older browsers) so it redraws once per actual new video frame instead of
 * spinning at 60fps regardless of the video's real frame rate.
 *
 * Usage (unchanged):
 *   <app-transparent-avatar
 *     class="rm-welcome-hero__avatar"
 *     src="assets/avatars/venki-wave.mp4"
 *   ></app-transparent-avatar>
 */
@Component({
  selector: 'app-transparent-avatar',
  standalone: true,
  template: `
    <canvas #canvas class="transparent-avatar-canvas"></canvas>
    <video
      #video
      [src]="src"
      style="display:none"
      muted
      playsinline
      loop
      autoplay
      preload="auto"
    ></video>
  `,
  styles: [
    `
      :host {
        display: block;
        line-height: 0;
      }
      .transparent-avatar-canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class TransparentAvatarComponent implements AfterViewInit, OnDestroy {
  /** Path to the side-by-side (RGB | alpha) mp4, e.g. assets/avatars/venki-wave.mp4 */
  @Input() src!: string;

  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private gl!: WebGLRenderingContext;
  private texture!: WebGLTexture;
  private program!: WebGLProgram;
  private vfcHandle: number | null = null;
  private rafId: number | null = null;
  private ready = false;
  private usingWebGL = true;

  // Fallback (CPU) path state, only used if WebGL is unavailable.
  private ctx2d: CanvasRenderingContext2D | null = null;
  private scratch: HTMLCanvasElement | null = null;

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    const gl = (canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true }) ||
      canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: true })) as WebGLRenderingContext | null;

    if (gl) {
      this.gl = gl;
      this.initWebGL();
    } else {
      this.usingWebGL = false;
      this.ctx2d = canvas.getContext('2d', { willReadFrequently: true });
      this.scratch = document.createElement('canvas');
    }

    video.addEventListener('loadedmetadata', () => {
      const outW = video.videoWidth / 2;
      const outH = video.videoHeight;

      canvas.width = outW;
      canvas.height = outH;

      if (this.usingWebGL) {
        this.gl.viewport(0, 0, outW, outH);
      }

      // Keep host sized the same way the old <img> was, via CSS aspect-ratio.
      this.hostRef.nativeElement.style.aspectRatio = `${outW} / ${outH}`;

      this.ready = true;
      video.play().catch(() => {
        // Autoplay can be blocked until user interaction; safe to ignore.
      });
      this.scheduleNextFrame();
    });
  }

  // ============================================================
  // WebGL path (fast — used on virtually all modern browsers)
  // ============================================================

  private initWebGL(): void {
    const gl = this.gl;

    const vsSrc = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = (aPos + 1.0) * 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;
    // Left half = color, right half = alpha mask (luminance carried in .r)
    const fsSrc = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D uTex;
      void main() {
        vec2 colorUv = vec2(vUv.x * 0.5, 1.0 - vUv.y);
        vec2 alphaUv = vec2(vUv.x * 0.5 + 0.5, 1.0 - vUv.y);
        vec3 color = texture2D(uTex, colorUv).rgb;
        float alpha = texture2D(uTex, alphaUv).r;
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);
    this.program = program;

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  private drawWebGL(video: HTMLVideoElement): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ============================================================
  // CPU fallback path (only if WebGL truly unavailable)
  // ============================================================

  private drawCPU(video: HTMLVideoElement): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = this.ctx2d!;
    const w = canvas.width;
    const h = canvas.height;

    const scratch = this.scratch!;
    scratch.width = w * 2;
    scratch.height = h;
    const sctx = scratch.getContext('2d')!;
    sctx.drawImage(video, 0, 0, w * 2, h);

    const full = sctx.getImageData(0, 0, w * 2, h);
    const out = ctx.createImageData(w, h);
    const src = full.data;
    const dst = out.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const colorIdx = (y * (w * 2) + x) * 4;
        const alphaIdx = (y * (w * 2) + (x + w)) * 4;
        const dstIdx = (y * w + x) * 4;
        dst[dstIdx] = src[colorIdx];
        dst[dstIdx + 1] = src[colorIdx + 1];
        dst[dstIdx + 2] = src[colorIdx + 2];
        dst[dstIdx + 3] = src[alphaIdx];
      }
    }
    ctx.putImageData(out, 0, 0);
  }

  // ============================================================
  // Frame scheduling — draw once per real video frame, not per rAF tick
  // ============================================================

  private scheduleNextFrame(): void {
    const video = this.videoRef.nativeElement as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };

    const drawIfReady = () => {
      if (this.ready && !video.paused && !video.ended) {
        if (this.usingWebGL) this.drawWebGL(video);
        else this.drawCPU(video);
      }
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      const step = () => {
        drawIfReady();
        this.vfcHandle = video.requestVideoFrameCallback!(step);
      };
      this.vfcHandle = video.requestVideoFrameCallback(step);
    } else {
      const step = () => {
        drawIfReady();
        this.rafId = requestAnimationFrame(step);
      };
      this.rafId = requestAnimationFrame(step);
    }
  }

  ngOnDestroy(): void {
    const video = this.videoRef.nativeElement as HTMLVideoElement & {
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    if (this.vfcHandle !== null && video.cancelVideoFrameCallback) {
      video.cancelVideoFrameCallback(this.vfcHandle);
    }
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }
}