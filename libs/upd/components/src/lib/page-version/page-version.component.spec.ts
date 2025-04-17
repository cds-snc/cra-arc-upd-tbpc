import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageVersionComponent } from './page-version.component';

describe('PageVersionComponent', () => {
  let component: PageVersionComponent;
  let fixture: ComponentFixture<PageVersionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageVersionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageVersionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
