use soroban_sdk::{Address, Env};

use crate::storage::{structs::rental::Rental, types::{error::Error, storage::DataKey}};

pub(crate) fn has_rental(env: &Env, renter: &Address, car_owner: &Address) -> bool {

    let key = DataKey::Rental(renter.clone(), car_owner.clone());
    env.storage().instance().has(&key)

}

pub(crate) fn write_rental(env: &Env, renter: &Address, car_owner: &Address, rental: &Rental) {
    let key = DataKey::Rental(renter.clone(), car_owner.clone());
    env.storage().instance().set(&key, rental)
}

pub(crate) fn read_rental(env: &Env, renter: &Address, car_owner: &Address) -> Result<Rental, Error> {
    let key = DataKey::Rental(renter.clone(), car_owner.clone());
    env.storage().instance().get(&key).ok_or(Error::RentalNotFound)
}

pub(crate) fn remove_rental(env: &Env, renter: &Address, car_owner: &Address) {
    let key = DataKey::Rental(renter.clone(), car_owner.clone());
    env.storage().instance().remove(&key)
}