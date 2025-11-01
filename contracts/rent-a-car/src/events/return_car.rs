use soroban_sdk::{Address, Env, Symbol};

pub fn car_returned(env: &Env, owner: Address) {
    let topics = (Symbol::new(env, "car_returned"), owner);
    env.events().publish(topics, ());
}