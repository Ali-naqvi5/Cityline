import { AdminIcon as AdminIcon_c53658d87906801e13270722b09ddbac } from "@/admin/components/brand";
import { AdminLogo as AdminLogo_c53658d87906801e13270722b09ddbac } from "@/admin/components/brand";
import { BackToOperations as BackToOperations_c53658d87906801e13270722b09ddbac } from "@/admin/components/brand";
import { DashboardRedirect as DashboardRedirect_bc25e25fd530623dfbb02f2d0f51c35b } from "@/admin/views/dashboard-redirect";
import { DashboardView as DashboardView_56545e2ed34b3ba298fe73d88e9741df } from "@/admin/views/dashboard";
import { BookingsView as BookingsView_ef636a9e55f1811d3c6237d3efe9f4b1 } from "@/admin/views/bookings";
import { JobsRedirect as JobsRedirect_ebe42abebdfe03894f98468740a962d7 } from "@/admin/views/jobs-redirect";
import { JobEditView as JobEditView_018c9dbcfb5d9bf039216b2afabfaa1f } from "@/admin/views/job-edit";
import { JobAssignView as JobAssignView_3457d931df502da08feb7d7f38e85e25 } from "@/admin/views/job-assign";
import { JobView as JobView_5c855259d8c4cca848a8268fc94ea8f6 } from "@/admin/views/job";
import { CustomersView as CustomersView_4fa2f82e138812fdb30688c310339925 } from "@/admin/views/customers";
import { CustomerEditView as CustomerEditView_ec9524a6de885bb7d51816505dff666f } from "@/admin/views/customer-edit";
import { CustomerView as CustomerView_7c5eead5882d2a37c0f10b73f50b9e60 } from "@/admin/views/customer";
import { JobsReportView as JobsReportView_ab89c31887b8491089ae23dd04802bbc } from "@/admin/views/report-jobs";
import { DriversReportView as DriversReportView_bb649636d28090d38f16549fc309e6ff } from "@/admin/views/report-drivers";
import { DriverPayView as DriverPayView_5c48c7c71d1f3069ca85f98722f16ace } from "@/admin/views/driver-pay";
import { DriverPayDriverView as DriverPayDriverView_781b90ec7150c73fbcf866eaf1118997 } from "@/admin/views/driver-pay-driver";
import { SupplierMoneyView as SupplierMoneyView_c3a0fad8d97eaf51d6da42984973d1d0 } from "@/admin/views/supplier-money";
import { SupplierMoneyPartnerView as SupplierMoneyPartnerView_ab291516c3adbb3de37f40256c6f4a2c } from "@/admin/views/supplier-money-partner";
import { PaymentsView as PaymentsView_8eaef7950caeb1e0fa58e8ae15ad67c8 } from "@/admin/views/payments";
import { PaymentView as PaymentView_fb6bb04aeac9916fc22ff42fe7395e45 } from "@/admin/views/payment";
import { RefundsView as RefundsView_9c5776f9fed9441c196cfcfd579f90b4 } from "@/admin/views/refunds";
import { ExpensesView as ExpensesView_7ba59370a65bb919bf79277c8d723e9d } from "@/admin/views/expenses";
import { FinanceReportView as FinanceReportView_4a1c8e63d94f74700ea09d3bc90a3481 } from "@/admin/views/report-finance";
import { RunSheetView as RunSheetView_51c29eb700373e4a02e2b100a852a89f } from "@/admin/views/report-run-sheet";
import { DispatchView as DispatchView_759e910e4ca7fcbc505c8147263dddbf } from "@/admin/views/dispatch";
import { DriversView as DriversView_5b3d267809e9c8ef7944527d000d51ca } from "@/admin/views/drivers";
import { DriverEditView as DriverEditView_3ac60765cb47a383e9bd29ba945977f7 } from "@/admin/views/driver-edit";
import { DriverView as DriverView_132979e2a4b45245f77bf426a5370f41 } from "@/admin/views/driver";
import { VehiclesView as VehiclesView_62f71e7f034871ae9cec09fe7581a3c4 } from "@/admin/views/vehicles";
import { VehicleEditView as VehicleEditView_0bd1b43cce41a72994fd9de135a485cf } from "@/admin/views/vehicle-edit";
import { VehicleView as VehicleView_7a561358a8c8b569c3b929d30c655829 } from "@/admin/views/vehicle";
import { ComplianceView as ComplianceView_4fb5b7cbbfd1ff69333d568991958cea } from "@/admin/views/compliance";
import { SuppliersView as SuppliersView_12c21d99cee898b2f1c4b0261af79483 } from "@/admin/views/suppliers";
import { SupplierEditView as SupplierEditView_9bba9ac9d3d9454de8ffbc4ab9b4befd } from "@/admin/views/supplier-edit";
import { SupplierView as SupplierView_f0082cf78846fbe490530ba18cf335f6 } from "@/admin/views/supplier";
import { AuditView as AuditView_8b89ac28f9934dce49bc5588fd8fc7d3 } from "@/admin/views/audit";
import { SettingsView as SettingsView_7fe7b5526c06e463b8bb586987c5dafe } from "@/admin/views/settings";
import { CollectionCards as CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1 } from "@payloadcms/next/rsc";

/** @type import('payload').ImportMap */
export const importMap = {
  "@/admin/components/brand#AdminIcon": AdminIcon_c53658d87906801e13270722b09ddbac,
  "@/admin/components/brand#AdminLogo": AdminLogo_c53658d87906801e13270722b09ddbac,
  "@/admin/components/brand#BackToOperations":
    BackToOperations_c53658d87906801e13270722b09ddbac,
  "@/admin/views/dashboard-redirect#DashboardRedirect":
    DashboardRedirect_bc25e25fd530623dfbb02f2d0f51c35b,
  "@/admin/views/dashboard#DashboardView": DashboardView_56545e2ed34b3ba298fe73d88e9741df,
  "@/admin/views/bookings#BookingsView": BookingsView_ef636a9e55f1811d3c6237d3efe9f4b1,
  "@/admin/views/jobs-redirect#JobsRedirect":
    JobsRedirect_ebe42abebdfe03894f98468740a962d7,
  "@/admin/views/job-edit#JobEditView": JobEditView_018c9dbcfb5d9bf039216b2afabfaa1f,
  "@/admin/views/job-assign#JobAssignView":
    JobAssignView_3457d931df502da08feb7d7f38e85e25,
  "@/admin/views/job#JobView": JobView_5c855259d8c4cca848a8268fc94ea8f6,
  "@/admin/views/customers#CustomersView": CustomersView_4fa2f82e138812fdb30688c310339925,
  "@/admin/views/customer-edit#CustomerEditView":
    CustomerEditView_ec9524a6de885bb7d51816505dff666f,
  "@/admin/views/customer#CustomerView": CustomerView_7c5eead5882d2a37c0f10b73f50b9e60,
  "@/admin/views/report-jobs#JobsReportView":
    JobsReportView_ab89c31887b8491089ae23dd04802bbc,
  "@/admin/views/report-drivers#DriversReportView":
    DriversReportView_bb649636d28090d38f16549fc309e6ff,
  "@/admin/views/driver-pay#DriverPayView":
    DriverPayView_5c48c7c71d1f3069ca85f98722f16ace,
  "@/admin/views/driver-pay-driver#DriverPayDriverView":
    DriverPayDriverView_781b90ec7150c73fbcf866eaf1118997,
  "@/admin/views/supplier-money#SupplierMoneyView":
    SupplierMoneyView_c3a0fad8d97eaf51d6da42984973d1d0,
  "@/admin/views/supplier-money-partner#SupplierMoneyPartnerView":
    SupplierMoneyPartnerView_ab291516c3adbb3de37f40256c6f4a2c,
  "@/admin/views/payments#PaymentsView": PaymentsView_8eaef7950caeb1e0fa58e8ae15ad67c8,
  "@/admin/views/payment#PaymentView": PaymentView_fb6bb04aeac9916fc22ff42fe7395e45,
  "@/admin/views/refunds#RefundsView": RefundsView_9c5776f9fed9441c196cfcfd579f90b4,
  "@/admin/views/expenses#ExpensesView": ExpensesView_7ba59370a65bb919bf79277c8d723e9d,
  "@/admin/views/report-finance#FinanceReportView":
    FinanceReportView_4a1c8e63d94f74700ea09d3bc90a3481,
  "@/admin/views/report-run-sheet#RunSheetView":
    RunSheetView_51c29eb700373e4a02e2b100a852a89f,
  "@/admin/views/dispatch#DispatchView": DispatchView_759e910e4ca7fcbc505c8147263dddbf,
  "@/admin/views/drivers#DriversView": DriversView_5b3d267809e9c8ef7944527d000d51ca,
  "@/admin/views/driver-edit#DriverEditView":
    DriverEditView_3ac60765cb47a383e9bd29ba945977f7,
  "@/admin/views/driver#DriverView": DriverView_132979e2a4b45245f77bf426a5370f41,
  "@/admin/views/vehicles#VehiclesView": VehiclesView_62f71e7f034871ae9cec09fe7581a3c4,
  "@/admin/views/vehicle-edit#VehicleEditView":
    VehicleEditView_0bd1b43cce41a72994fd9de135a485cf,
  "@/admin/views/vehicle#VehicleView": VehicleView_7a561358a8c8b569c3b929d30c655829,
  "@/admin/views/compliance#ComplianceView":
    ComplianceView_4fb5b7cbbfd1ff69333d568991958cea,
  "@/admin/views/suppliers#SuppliersView": SuppliersView_12c21d99cee898b2f1c4b0261af79483,
  "@/admin/views/supplier-edit#SupplierEditView":
    SupplierEditView_9bba9ac9d3d9454de8ffbc4ab9b4befd,
  "@/admin/views/supplier#SupplierView": SupplierView_f0082cf78846fbe490530ba18cf335f6,
  "@/admin/views/audit#AuditView": AuditView_8b89ac28f9934dce49bc5588fd8fc7d3,
  "@/admin/views/settings#SettingsView": SettingsView_7fe7b5526c06e463b8bb586987c5dafe,
  "@payloadcms/next/rsc#CollectionCards":
    CollectionCards_f9c02e79a4aed9a3924487c0cd4cafb1,
};
