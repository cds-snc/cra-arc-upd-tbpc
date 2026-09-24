import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortalPagesComponent } from './portal-pages.component';

describe('PortalPagesComponent', () => {
  let component: PortalPagesComponent;
  let fixture: ComponentFixture<PortalPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PortalPagesComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PortalPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
