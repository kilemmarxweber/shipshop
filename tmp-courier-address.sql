UPDATE courier SET address = CASE phone
  WHEN '+243820000001' THEN 'Av. du Port, Gombe, Kinshasa'
  WHEN '+243820000002' THEN 'Blvd Lumumba, Limete, Kinshasa'
  WHEN '+243820000003' THEN 'Route de Nsele, Nsele, Kinshasa'
  ELSE address END
WHERE address IS NULL OR address = '';
