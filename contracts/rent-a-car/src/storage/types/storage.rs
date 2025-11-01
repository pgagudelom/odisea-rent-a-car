use soroban_sdk::{contracttype, Address};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,                          // dirección del administrador del contrato
    Token,
    ContractBalance,               // dirección del token de pago aceptado
    Car(Address),                  // auto asociado a un owner
    Rental(Address, Address),      // registro de alquiler entre renter y owner
    AdminCommission,               // comisión base configurada por el admin
    AdminAccumulatedCommission,    // comisiones acumuladas disponibles para el admin
}