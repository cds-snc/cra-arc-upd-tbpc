import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagesDetailsSummaryComponent } from './portal-portal-pages-details-summary.component';

describe('PageDetailsSummaryComponent', () => {
  let component: PagesDetailsSummaryComponent;
  let fixture: ComponentFixture<PagesDetailsSummaryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagesDetailsSummaryComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PagesDetailsSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
