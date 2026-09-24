import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalPagesDetailsComponent } from './portal-portal-pages-details.component';

describe('PageDetailsComponent', () => {
  let component: PortalPagesDetailsComponent;
  let fixture: ComponentFixture<PortalPagesDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortalPagesDetailsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PortalPagesDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
