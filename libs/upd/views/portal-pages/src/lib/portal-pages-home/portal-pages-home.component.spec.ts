import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalPagesHomeComponent } from './portal-pages-home.component';

describe('PortalPagesHomeComponent', () => {
  let component: PortalPagesHomeComponent;
  let fixture: ComponentFixture<PortalPagesHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortalPagesHomeComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PortalPagesHomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
