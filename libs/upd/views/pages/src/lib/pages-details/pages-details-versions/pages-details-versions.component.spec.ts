import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagesDetailsVersionsComponent } from './pages-details-versions.component';

describe('PageDetailsWebtrafficComponent', () => {
  let component: PagesDetailsVersionsComponent;
  let fixture: ComponentFixture<PagesDetailsVersionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PagesDetailsVersionsComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PagesDetailsVersionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
