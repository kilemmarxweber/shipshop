UPDATE "wallet"
SET
  "buyerUsdCents" = "usdCents",
  "buyerCdfCents" = "cdfCents",
  "buyerKwCents" = "kwCents"
WHERE
  ("buyerUsdCents" + "vendorUsdCents" + "courierUsdCents") = 0
  AND ("buyerCdfCents" + "vendorCdfCents" + "courierCdfCents") = 0
  AND ("buyerKwCents" + "vendorKwCents" + "courierKwCents") = 0
  AND ("usdCents" + "cdfCents" + "kwCents") > 0;
