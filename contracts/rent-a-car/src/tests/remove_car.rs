use soroban_sdk::{testutils::{Address as _, MockAuth, MockAuthInvoke}, IntoVal, Address};
use crate::{storage::{car::has_car}, tests::config::contract::ContractTest};

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
pub fn test_unauthorized_user_cannot_remove_car() {
    let ContractTest { env, contract, admin,.. } = ContractTest::setup();

	let fake_admin = Address::generate(&env);
    let owner = Address::generate(&env);

    contract
        .mock_auths(&[MockAuth {
            address: &fake_admin ,
            invoke: &MockAuthInvoke {
                contract: &contract.address.clone(),
                fn_name: "remove_car",
                args: (owner.clone(),).into_val(&env),
                sub_invokes: &[],
            },
        }]).remove_car(&owner);
}

#[test]
pub fn test_remove_car_deletes_from_storage() {
    let ContractTest { env, contract, admin, .. } = ContractTest::setup();
    env.mock_all_auths();
    let owner = Address::generate(&env);
    let price_per_day = 1500_i128;
    let comission = 10_i128;
    contract.add_car(&owner, &price_per_day, &comission);
    assert!(env.as_contract(&contract.address, || {
        has_car(&env, &owner)
    }));

    contract.remove_car(&owner);
    assert!(!env.as_contract(&contract.address, || {
        has_car(&env, &owner)
    }));
}