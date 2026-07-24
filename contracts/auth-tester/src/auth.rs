#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct AuthTester;


#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
pub enum DataKey {
    EmissionCount,
}

#[contract]
pub struct EventFixture;

#[contractimpl]
impl EventFixture {
    pub fn emit_message(env: Env, sender: Address, topic: Symbol, value: i128) {
        sender.require_auth();

        let count = Self::event_count(env.clone()) + 1;
        env.storage().persistent().set(&DataKey::EmissionCount, &count);
        env.events()
            .publish((Symbol::new(&env, "message"), sender, topic), value);
    }

    pub fn emit_checkpoint(env: Env, checkpoint: u32) {
        let count = Self::event_count(env.clone()) + 1;
        env.storage().persistent().set(&DataKey::EmissionCount, &count);
        env.events()
            .publish((Symbol::new(&env, "checkpoint"),), checkpoint);
    }

    pub fn event_count(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::EmissionCount)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};

    #[test]
    fn event_fixture_tracks_emissions() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, EventFixture);
        let client = EventFixtureClient::new(&env, &contract_id);
        let sender = Address::generate(&env);

        client.emit_message(&sender, &Symbol::new(&env, "alpha"), &12);
        client.emit_checkpoint(&5);

        assert_eq!(client.event_count(), 2);
    }

    #[test]
    fn event_fixture_starts_at_zero() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EventFixture);
        let client = EventFixtureClient::new(&env, &contract_id);

        assert_eq!(client.event_count(), 0);
    }
}

#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidInput = 1,
    Unauthorized = 2,
    Overflow = 3,
}

#[contract]
pub struct ErrorTriggerContract;

#[contractimpl]
impl ErrorTriggerContract {
    pub fn trigger_panic(_env: Env) {
        panic!("intentional panic for diagnostic testing");
    }

    pub fn trigger_assert(_env: Env, value: u32) {
        assert!(value == 0, "assertion failed: value must be zero");
    }

    pub fn trigger_custom_error(_env: Env, code: u32) -> Result<u32, Error> {
        match code {
            1 => Err(Error::InvalidInput),
            2 => Err(Error::Unauthorized),
            3 => Err(Error::Overflow),
            _ => Ok(code),
        }
    }
}


#[contractimpl]
impl AuthTester {
    /// A function that requires authorization from two different addresses.
    /// This is useful for testing how the UI handles multiple required authorizations.
    pub fn multi_auth(_env: Env, user1: Address, user2: Address) {
        user1.require_auth();
        user2.require_auth();
    }
}
#![no_std]

use soroban_sdk::{contract, contracterror, contractimpl, Env};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Failure {
    InvalidInput = 1,
    Forbidden = 2,
}

#[contract]
pub struct FailureFixture;

#[contractimpl]
impl FailureFixture {
    pub fn fail_if_zero(_env: Env, value: u32) -> Result<u32, Failure> {
        if value == 0 {
            return Err(Failure::InvalidInput);
        }

        Ok(value)
    }

    pub fn fail_if_forbidden(_env: Env, is_forbidden: bool) -> Result<(), Failure> {
        if is_forbidden {
            return Err(Failure::Forbidden);
        }

        Ok(())
    }

    pub fn always_panic(_env: Env) {
        panic!("intentional failure fixture panic");
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::Env;

    #[test]
    fn failure_fixture_returns_success_for_valid_input() {
        let env = Env::default();
        let contract_id = env.register_contract(None, FailureFixture);
        let client = FailureFixtureClient::new(&env, &contract_id);

        assert_eq!(client.fail_if_zero(&7), 7);
        client.fail_if_forbidden(&false);
    }

    #[test]
    fn failure_fixture_reports_expected_errors() {
        let env = Env::default();
        let contract_id = env.register_contract(None, FailureFixture);
        let client = FailureFixtureClient::new(&env, &contract_id);

        assert!(client.try_fail_if_zero(&0).is_err());
        assert!(client.try_fail_if_forbidden(&true).is_err());
    }

    #[test]
    fn failure_fixture_exposes_panics_for_failure_paths() {
        let env = Env::default();
        let contract_id = env.register_contract(None, FailureFixture);
        let client = FailureFixtureClient::new(&env, &contract_id);

        assert!(client.try_always_panic().is_err());
    }
}
