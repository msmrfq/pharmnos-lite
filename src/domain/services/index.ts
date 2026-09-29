export * from "./gst-calculator.service";
export * from "./fefo-batch.service";
export * from "./stock-movement.service";
export * from "./ledger-impact.service";

import { gstCalculator } from "./gst-calculator.service";
import { fefoBatchPicker } from "./fefo-batch.service";
import { stockMovementService } from "./stock-movement.service";
import { ledgerImpactService } from "./ledger-impact.service";

export const domainServices = {
  gst: gstCalculator,
  fefo: fefoBatchPicker,
  stockMovements: stockMovementService,
  ledgerImpact: ledgerImpactService,
};
