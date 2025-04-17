import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomReportsFeedbackReportComponent } from './custom-reports-feedback-report.component';

describe('CustomReportsFeedbackReportComponent', () => {
  let component: CustomReportsFeedbackReportComponent;
  let fixture: ComponentFixture<CustomReportsFeedbackReportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomReportsFeedbackReportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomReportsFeedbackReportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
