import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagesDetailsWebtrafficComponent } from './pages-details-webtraffic.component';

describe('PageDetailsWebtrafficComponent', () => {
  let component: PagesDetailsWebtrafficComponent;
  let fixture: ComponentFixture<PagesDetailsWebtrafficComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagesDetailsWebtrafficComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PagesDetailsWebtrafficComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
