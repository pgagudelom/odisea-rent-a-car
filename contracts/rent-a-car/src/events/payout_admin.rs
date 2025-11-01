use soroban_sdk::{Address, Env, Symbol};

pub(crate) fn payout_admin(env: &Env, admin: Address, amount: i128) {

    let topics = (Symbol::new(env, "payout_admin"), admin.clone());

    env.events().publish(
        topics,
        amount
    );
}