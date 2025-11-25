import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagesDetailsAccessibilityComponent } from './pages-details-accessibility.component';

describe('PagesDetailsAccessibilityComponent', () => {
  let component: PagesDetailsAccessibilityComponent;
  let fixture: ComponentFixture<PagesDetailsAccessibilityComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagesDetailsAccessibilityComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PagesDetailsAccessibilityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
