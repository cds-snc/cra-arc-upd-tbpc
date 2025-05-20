import { Component, Input } from '@angular/core';

@Component({
    selector: 'upd-accordion',
    template: `
    <div ngbAccordion [class]="flash" [ngClass]="styleClass">
      <div ngbAccordionItem [collapsed]="!expanded">
        <h2 ngbAccordionHeader [ngClass]="headerClass">
          <button ngbAccordionButton>{{ title | translate }}</button>
        </h2>

        <div ngbAccordionCollapse>
          <div ngbAccordionBody class="p-2">
            <ng-template>
              <ng-content></ng-content>
            </ng-template>
          </div>
        </div>
      </div>
    </div>
  `,
    styleUrls: ['./accordion.component.scss'],
    standalone: false
})
export class AccordionComponent {
  @Input() title = 'view-data-table';
  @Input() styleClass = '';
  @Input() expanded = false;
  @Input() headerClass?: string | string[];

  flash = '';

  flashAccordion() {
    this.flash = 'flash';

    setTimeout(() => {
      this.flash = '';
    }, 1000); // Duration should match the total animation time
  }
}
