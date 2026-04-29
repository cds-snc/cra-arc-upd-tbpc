import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApexScoreComponent } from './apex-score.component';

describe('ApexScoreComponent', () => {
  let component: ApexScoreComponent;
  let fixture: ComponentFixture<ApexScoreComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApexScoreComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ApexScoreComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
