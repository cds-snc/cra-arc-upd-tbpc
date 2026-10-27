import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalPagesDetailsSummaryComponent } from './portal-pages-details-summary.component';

describe('PortalPagesDetailsSummaryComponent', () => {
  let component: PortalPagesDetailsSummaryComponent;
  let fixture: ComponentFixture<PortalPagesDetailsSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortalPagesDetailsSummaryComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PortalPagesDetailsSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
