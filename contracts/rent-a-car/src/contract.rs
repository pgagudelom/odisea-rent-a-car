use crate::{
    events,
    interfaces::contract::RentACarContractTrait,
    methods::{public::get_car_status::get_car_status, token::token::token_transfer},
    storage::{
        admin::{has_admin, read_admin, write_admin},
        car::{has_car, read_car, remove_car, write_car},
        comission::{read_accumulated_commission, write_accumulated_commission},
        contract_balance::{read_contract_balance, write_contract_balance},
        rental::write_rental,
        structs::{car::Car, rental::Rental},
        token::write_token,
        types::{car_status::CarStatus, error::Error},
    },
};
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct RentACarContract;

#[contractimpl]
impl RentACarContractTrait for RentACarContract {
    fn __constructor(env: &Env, admin: Address, token: Address) -> Result<(), Error> {
        if admin == token {
            return Err(Error::AdminTokenConflict);
        }

        if has_admin(&env) {
            return Err(Error::ContractInitialized);
        }

        write_admin(env, &admin);
        write_token(env, &token);

        events::contract::contract_initialized(env, admin, token);
        Ok(())
    }

    fn add_car(
        env: &Env,
        owner: Address,
        price_per_day: i128,
        commission: i128,
    ) -> Result<(), Error> {
        let admin = read_admin(env)?;
        admin.require_auth();

        if price_per_day <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        if has_car(env, &owner) {
            return Err(Error::CarAlreadyExist);
        }

        // Validar que la comisión sea un porcentaje válido (0-100)
        if commission < 0 || commission > 100 {
            return Err(Error::CommissionTooHigh);
        }

        let car = Car {
            price_per_day,
            car_status: CarStatus::Available,
            available_to_withdraw: 0,
            comission_to_admin: commission,
        };

        write_car(env, &owner, &car);
        events::add_car::car_added(env, owner, price_per_day);
        Ok(())
    }

    fn get_car_status(env: &Env, owner: Address) -> Result<CarStatus, Error> {
        get_car_status(env, &owner)
    }

    fn rental(
        env: &Env,
        renter: Address,
        owner: Address,
        total_days_to_rent: u32,
        amount: i128,
    ) -> Result<(), Error> {
        renter.require_auth();

        if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        if total_days_to_rent == 0 {
            return Err(Error::RentalDurationCannotBeZero);
        }

        if renter == owner {
            return Err(Error::SelfRentalNotAllowed);
        }

        let mut car = read_car(env, &owner)?;

        if car.car_status != CarStatus::Available {
            return Err(Error::CarAlreadyRented);
        }

        // Calcular el monto total incluyendo la comisión
        let total_to_pay = if car.comission_to_admin > 0 {
            let commission = car
                .comission_to_admin
                .checked_mul(amount)
                .ok_or(Error::MathOverFlow)?
                .checked_div(100)
                .ok_or(Error::MathOverFlow)?;

            amount.checked_add(commission).ok_or(Error::MathOverFlow)?
        } else {
            amount
        };

        // El arrendatario paga el monto total (alquiler + comisión)
        token_transfer(
            &env,
            &renter,
            &env.current_contract_address(),
            &total_to_pay,
        )?;
        car.car_status = CarStatus::Rented;

        // Calcular y procesar la comisión si está configurada
        let commission_amount = if car.comission_to_admin > 0 {
            // Calcular la comisión del admin (porcentaje adicional sobre el monto del alquiler)
            let commission = car
                .comission_to_admin
                .checked_mul(amount)
                .ok_or(Error::MathOverFlow)?
                .checked_div(100)
                .ok_or(Error::MathOverFlow)?;

            // Actualizar las comisiones acumuladas del admin
            let current_accumulated = read_accumulated_commission(&env);
            let new_accumulated = current_accumulated
                .checked_add(commission)
                .ok_or(Error::MathOverFlow)?;
            write_accumulated_commission(&env, &new_accumulated);

            commission
        } else {
            0 // Si no hay comisión configurada
        };

        // El owner recibe el monto completo del alquiler
        car.available_to_withdraw = car
            .available_to_withdraw
            .checked_add(amount)
            .ok_or(Error::MathOverFlow)?;

        // Registrar el alquiler con la comisión
        let rental = Rental {
            total_days_to_rent,
            amount,
            commission: commission_amount,
        };

        // Actualizar el balance del contrato con el monto del alquiler más la comisión
        let mut contract_balance = read_contract_balance(&env);
        let total_amount = amount
            .checked_add(commission_amount)
            .ok_or(Error::MathOverFlow)?;

        contract_balance = contract_balance
            .checked_add(total_amount)
            .ok_or(Error::MathOverFlow)?;

        write_contract_balance(&env, &contract_balance);
        write_car(env, &owner, &car);
        write_rental(env, &renter, &owner, &rental);

        // Emitir el evento con el monto completo del alquiler
        events::rental::rented(env, renter, owner, total_days_to_rent, amount);
        Ok(())
    }

    fn remove_car(env: &Env, owner: Address) -> Result<(), Error> {
        let admin = read_admin(env)?;
        admin.require_auth();

        if !has_car(env, &owner) {
            return Err(Error::CarNotFound);
        }
        remove_car(env, &owner);
        events::remove_car::car_removed(env, owner);
        Ok(())
    }

    fn payout_owner(env: &Env, owner: Address, amount: i128) -> Result<(), Error> {
        owner.require_auth();

        if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        let mut car = read_car(&env, &owner)?;

        if amount > car.available_to_withdraw {
            return Err(Error::InsufficientBalance);
        }

        let mut contract_balance = read_contract_balance(&env);

        if amount > contract_balance {
            return Err(Error::BalanceNotAvailableForAmountRequested);
        }

        token_transfer(&env, &env.current_contract_address(), &owner, &amount)?;

        car.available_to_withdraw = car
            .available_to_withdraw
            .checked_sub(amount)
            .ok_or(Error::MathOverFlow)?;

        contract_balance = contract_balance
            .checked_sub(amount)
            .ok_or(Error::MathOverFlow)?;

        write_car(&env, &owner, &car);
        write_contract_balance(&env, &contract_balance);

        events::payout_owner::payout_owner(env, owner, amount);
        Ok(())
    }

    fn return_car(env: &Env, owner: Address) -> Result<(), Error> {
        // Solo el dueño puede devolver el auto
        owner.require_auth();

        let mut car = read_car(&env, &owner)?;

        // Verificar que el auto está rentado
        if car.car_status != CarStatus::Rented {
            return Err(Error::CarNotRented);
        }

        // Cambiar el estado del auto a disponible
        car.car_status = CarStatus::Available;
        write_car(&env, &owner, &car);

        // Emitir evento de devolución
        events::return_car::car_returned(env, owner);
        Ok(())
    }

    fn get_admin_balance(env: &Env) -> Result<i128, Error> {
        let admin = read_admin(env)?;
        admin.require_auth();

        let balance = read_accumulated_commission(env);
        Ok(balance)
    }


    fn payout_admin(env: &Env, amount: i128) -> Result<(), Error> {
        let admin = read_admin(env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(Error::AmountMustBePositive);
        }

        let mut contract_balance = read_contract_balance(&env);

        if amount > contract_balance {
            return Err(Error::BalanceNotAvailableForAmountRequested);
        }

        token_transfer(&env, &env.current_contract_address(), &admin, &amount)?;

        let balance = read_accumulated_commission(env);

        if amount > balance {
            return Err(Error::InsufficientBalance);
        }

        contract_balance = contract_balance
            .checked_sub(amount)
            .ok_or(Error::MathOverFlow)?;

        write_contract_balance(&env, &contract_balance);

        events::payout_admin::payout_admin(env, admin, amount);
        Ok(())
    }

}
