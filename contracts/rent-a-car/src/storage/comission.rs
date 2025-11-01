use soroban_sdk::Env;
use crate::storage::types::{error::Error, storage::DataKey};

/// Lee la comisión actual configurada por el administrador
pub(crate) fn read_accumulated_commission(env: &Env) -> i128 {
    let key = DataKey::AdminAccumulatedCommission;
    env.storage().instance().get(&key).unwrap_or(0)
}

/// Guarda una nueva comisión acumulada para el administrador
pub(crate) fn write_accumulated_commission(env: &Env, amount: &i128) {
    let key = DataKey::AdminAccumulatedCommission;
    env.storage().instance().set(&key, amount);
}

/// Verifica si existe una comisión configurada
pub(crate) fn has_commission(env: &Env) -> bool {
    let key = DataKey::AdminCommission;
    env.storage().instance().has(&key)
}

/// Lee la comisión configurada
pub(crate) fn read_commission(env: &Env) -> Result<i128, Error> {
    let key = DataKey::AdminCommission;
    env.storage().instance().get(&key).ok_or(Error::CommissionNotSet)
}

/// Guarda una nueva comisión
pub(crate) fn write_commission(env: &Env, commission: &i128) {
    let key = DataKey::AdminCommission;
    env.storage().instance().set(&key, commission);
}