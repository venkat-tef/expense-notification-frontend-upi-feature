import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MemberService } from '../../../core/services/member.service';
import { Member } from '../../../core/models/member.model';
import { MemberFormDialog } from './member-form-dialog/member-form-dialog';

@Component({
  selector: 'app-members-tab',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    DragDropModule,
  ],
  templateUrl: './members-tab.html',
  styleUrl: './members-tab.scss',
})
export class MembersTab {
  readonly memberService = inject(MemberService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Local draft order while dragging — only persisted when "Save Order" is tapped, so an
   *  accidental drag never silently rewrites everyone's rotation. */
  readonly draftOrder = signal<Member[] | null>(null);
  readonly savingOrder = signal(false);

  get displayList(): Member[] {
    return this.draftOrder() ?? this.memberService.members();
  }

  get orderDirty(): boolean {
    return this.draftOrder() !== null;
  }

  onDrop(event: CdkDragDrop<Member[]>): void {
    const list = [...this.displayList];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.draftOrder.set(list);
  }

  async saveOrder(): Promise<void> {
    const list = this.draftOrder();
    if (!list) return;
    this.savingOrder.set(true);
    try {
      await this.memberService.reorderMembers(list.map((m) => m.id));
      this.draftOrder.set(null);
      this.snackBar.open('Member order updated successfully.', undefined, {
        duration: 2000,
        panelClass: 'rm-snack-success',
      });
    } finally {
      this.savingOrder.set(false);
    }
  }

  discardOrder(): void {
    this.draftOrder.set(null);
  }

  openAddMember(): void {
    const ref = this.dialog.open(MemberFormDialog, { data: {}, width: '440px', maxWidth: '95vw', autoFocus: false });
    ref.afterClosed().subscribe(() => {});
  }

  openEditMember(member: Member): void {
    const ref = this.dialog.open(MemberFormDialog, {
      data: { member },
      width: '440px',
      maxWidth: '95vw',
      autoFocus: false,
    });
    ref.afterClosed().subscribe(() => {});
  }

  async deleteMember(member: Member): Promise<void> {
    const confirmed = confirm(
      `Remove ${member.name}? Note: this removes their app profile but does not delete their login account.`
    );
    if (!confirmed) return;
    await this.memberService.deleteMember(member.id);
    this.snackBar.open(`${member.name} removed.`, undefined, { duration: 1800 });
  }

  savingApproverId = signal<string | null>(null);

  async makeApprover(member: Member): Promise<void> {
    if (member.isPaymentApprover) return;
    this.savingApproverId.set(member.id);
    try {
      await this.memberService.setPaymentApprover(member.id);
      this.snackBar.open(`${member.name} is now the payment approver.`, undefined, { duration: 2000 });
    } finally {
      this.savingApproverId.set(null);
    }
  }

  // --- My UPI ID (self-service, unchanged from the original Settings component) --------

  readonly editingUpi = signal(false);
  readonly upiDraft = signal('');
  readonly savingUpi = signal(false);

  startEditUpi(): void {
    this.upiDraft.set(this.memberService.currentMember()?.upiId ?? '');
    this.editingUpi.set(true);
  }

  async saveUpi(): Promise<void> {
    const value = this.upiDraft().trim();
    if (!value || !value.includes('@')) {
      this.snackBar.open('Enter a valid UPI ID, e.g. name@bank.', 'OK', { duration: 3000 });
      return;
    }
    this.savingUpi.set(true);
    try {
      await this.memberService.updateOwnUpiId(value);
      this.editingUpi.set(false);
      this.snackBar.open('UPI ID saved.', undefined, { duration: 1800, panelClass: 'rm-snack-success' });
    } finally {
      this.savingUpi.set(false);
    }
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
  }
}
