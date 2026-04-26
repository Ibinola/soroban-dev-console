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
