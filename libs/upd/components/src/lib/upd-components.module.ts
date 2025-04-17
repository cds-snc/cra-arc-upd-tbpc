import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  NgbModule,
  NgbDropdownModule,
  NgbPopoverModule,
  NgbAlertModule,
  NgbAccordionModule,
  NgbModalModule,
  NgbTooltipModule,
} from '@ng-bootstrap/ng-bootstrap';
import { ProgressBar, ProgressBarModule } from 'primeng/progressbar';
import { CardComponent } from './card/card.component';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { SliderModule } from 'primeng/slider';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { TreeSelectModule } from 'primeng/treeselect';
import { TabViewModule } from 'primeng/tabview';
import { PipesModule } from '@dua-upd/upd/pipes';
import { DataCardComponent } from './data-card/data-card.component';
import { DataTableComponent } from './data-table/data-table.component';
import { DateSelectorComponent } from './date-selector/date-selector.component';
import { DateSelectorDropdownComponent } from './date-selector/date-selector-dropdown.component';
import { NavTabsComponent } from './nav-tabs/nav-tabs.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputSwitchModule } from 'primeng/inputswitch';
import { AlertComponent } from './alert/alert.component';
import { AccordionComponent } from './accordion/accordion.component';
import { ModalComponent } from './modal/modal.component';
import { DataKpiCardComponent } from './data-kpi-card/data-kpi-card.component';
import { DataTableStylesComponent } from './data-table-styles/data-table-styles.component';
import { ProjectStatusLabelComponent } from './project-status-label/project-status-label.component';
import { DataTableCardComponent } from './data-table-card/data-table-card.component';
import { Page404Component } from './page-404/page-404.component';
import { LoadingSpinnerComponent } from './loading-spinner/loading-spinner.component';
import { I18nModule } from '@dua-upd/upd/i18n';
import { ProjectHeaderComponent } from './project-header/project-header.component';
import { NgApexchartsModule } from 'ng-apexcharts';
import { CardSecondaryTitleComponent } from './card-secondary-title/card-secondary-title.component';
import { DataTableExportsComponent } from './data-table-exports/data-table-exports.component';
import { DropdownComponent } from './dropdown/dropdown.component';
import { ApexBarLineComponent } from './apex-bar-line/apex-bar-line.component';
import { ApexRadialBarComponent } from './apex-radial-bar/apex-radial-bar.component';
import { ApexBarComponent } from './apex-bar/apex-bar.component';
import { ApexDonutComponent } from './apex-donut/apex-donut.component';
import { ApexSparkLineComponent } from './apex-spark-line/apex-spark-line.component';
import { FilterTableComponent } from './filter-table/filter-table.component';
import { FilterTableSelectionComponent } from './filter-table-selection/filter-table-selection.component';
import { CalendarComponent } from './calendar/calendar.component';
import { CheckboxComponent } from './checkbox/checkbox.component';
import { InputSwitchComponent } from './input-switch/input-switch.component';
import { RadioComponent } from './radio/radio.component';
import { DidYouKnowComponent } from './did-you-know/did-you-know.component';
import { RangeSliderComponent } from './range-slider/range-slider.component';
import { HeatmapComponent } from './heatmap/heatmap.component';
import { PageFlowComponent } from './page-flow/page-flow.component';
import { ArrowConnectComponent } from './arrow-connect/arrow-connect.component';
import { PageVersionComponent } from './page-version/page-version.component';

@NgModule({
  imports: [
    CommonModule,
    RouterModule,
    NgbAccordionModule,
    NgbAlertModule,
    NgbDropdownModule,
    NgbPopoverModule,
    NgbModalModule,
    NgbTooltipModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    CheckboxModule,
    RadioButtonModule,
    TabViewModule,
    InputSwitchModule,
    NgbModule,
    I18nModule,
    DropdownModule,
    FormsModule,
    MultiSelectModule,
    TreeSelectModule,
    SliderModule,
    CalendarModule,
    InputNumberModule,
    PipesModule,
    NgApexchartsModule,
    ProgressBarModule,
    RangeSliderComponent,
],
  declarations: [
    CardComponent,
    DataTableComponent,
    DateSelectorComponent,
    DateSelectorDropdownComponent,
    NavTabsComponent,
    DataCardComponent,
    AlertComponent,
    AccordionComponent,
    ModalComponent,
    DataTableStylesComponent,
    ProjectStatusLabelComponent,
    DataKpiCardComponent,
    DataTableCardComponent,
    Page404Component,
    LoadingSpinnerComponent,
    ProjectHeaderComponent,
    CardSecondaryTitleComponent,
    DataTableExportsComponent,
    DropdownComponent,
    ApexBarLineComponent,
    ApexRadialBarComponent,
    ApexBarComponent,
    ApexDonutComponent,
    ApexSparkLineComponent,
    FilterTableComponent,
    FilterTableSelectionComponent,
    CalendarComponent,
    CheckboxComponent,
    InputSwitchComponent,
    RadioComponent,
    DidYouKnowComponent,
    HeatmapComponent,
    PageFlowComponent,
    ArrowConnectComponent,
    PageVersionComponent,
  ],
  exports: [
    NgbPopoverModule,
    NgbAlertModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    CheckboxModule,
    RadioButtonModule,
    TabViewModule,
    InputSwitchModule,
    CalendarComponent,
    CardComponent,
    DataTableComponent,
    DateSelectorComponent,
    DateSelectorDropdownComponent,
    NavTabsComponent,
    DataCardComponent,
    AlertComponent,
    AccordionComponent,
    ModalComponent,
    DataTableStylesComponent,
    ProjectStatusLabelComponent,
    DataKpiCardComponent,
    DataTableCardComponent,
    Page404Component,
    LoadingSpinnerComponent,
    ProjectHeaderComponent,
    CardSecondaryTitleComponent,
    DataTableExportsComponent,
    ApexBarLineComponent,
    ApexRadialBarComponent,
    ApexBarComponent,
    ApexDonutComponent,
    ApexSparkLineComponent,
    FilterTableComponent,
    FilterTableSelectionComponent,
    CheckboxComponent,
    DropdownComponent,
    InputSwitchComponent,
    RadioComponent,
    ProgressBar,
    DidYouKnowComponent,
    RangeSliderComponent,
    HeatmapComponent,
    PageFlowComponent,
    ArrowConnectComponent,
    PageVersionComponent,
  ],
})
export class UpdComponentsModule {}
