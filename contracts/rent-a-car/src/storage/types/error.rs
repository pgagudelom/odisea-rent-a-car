use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    ContractInitialized = 0,
    ContractNotInitialized = 1,
    CarNotFound = 2,
    AdminTokenConflict = 3,
    CarAlreadyRented = 4,
    CarAlreadyExist = 5,
    AmountMustBePositive = 6,
    RentalNotFound = 7,
    InsufficientBalance = 8,
    BalanceNotAvailableForAmountRequested = 9,
    SelfRentalNotAllowed = 10,
    RentalDurationCannotBeZero = 11,
    TokenNotFound = 12,
    AdminNotFound = 13,
    MathOverFlow = 14,
    CommissionNotSet = 15,
    CarNotRented = 16,  // Error cuando se intenta devolver un auto que no está rentado
    CommissionTooHigh = 17,
}