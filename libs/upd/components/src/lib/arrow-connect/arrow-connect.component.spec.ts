import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArrowConnectComponent } from './arrow-connect.component';

describe('ArrowConnectComponent', () => {
  let component: ArrowConnectComponent;
  let fixture: ComponentFixture<ArrowConnectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArrowConnectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ArrowConnectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
