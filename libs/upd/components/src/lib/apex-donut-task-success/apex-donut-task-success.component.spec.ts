import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApexDonutTaskSuccessComponent } from './apex-donut-task-success.component';

describe('ApexDonutTaskSuccessComponent', () => {
  let component: ApexDonutTaskSuccessComponent;
  let fixture: ComponentFixture<ApexDonutTaskSuccessComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ApexDonutTaskSuccessComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ApexDonutTaskSuccessComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
