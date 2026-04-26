#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String};

#[contracttype]
pub enum DataKey {
    /// Maps a contract Address to its registered repository URL.
    Source(Address),
}

#[contract]
pub struct SourceRegistry;

#[contractimpl]
impl SourceRegistry {
    /// Register or update the source repository URL for a contract.
    ///
    /// The caller must be the contract address being registered — enforced via
    /// `contract.require_auth()`. This ensures only the contract deployer
    /// (who controls the contract's auth) can register or overwrite the entry.
    pub fn register_source(env: Env, contract: Address, repo_url: String) {
        contract.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Source(contract), &repo_url);
    }

    /// Retrieve the registered repository URL for a contract.
    ///
    /// Returns `None` if the contract has not been registered.
    pub fn get_source(env: Env, contract: Address) -> Option<String> {
        env.storage()
            .persistent()
            .get(&DataKey::Source(contract))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    #[test]
    fn test_register_and_get_source() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SourceRegistry, ());
        let client = SourceRegistryClient::new(&env, &contract_id);

        let target_contract = Address::generate(&env);
        let url = String::from_str(&env, "https://github.com/example/my-contract");

        client.register_source(&target_contract, &url);

        let result = client.get_source(&target_contract);
        assert_eq!(result, Some(url));
    }

    #[test]
    fn test_get_source_unregistered_returns_none() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SourceRegistry, ());
        let client = SourceRegistryClient::new(&env, &contract_id);

        let unknown = Address::generate(&env);
        assert!(client.get_source(&unknown).is_none());
    }

    #[test]
    fn test_register_overwrites_existing_url() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SourceRegistry, ());
        let client = SourceRegistryClient::new(&env, &contract_id);

        let target = Address::generate(&env);
        let url_v1 = String::from_str(&env, "https://github.com/example/v1");
        let url_v2 = String::from_str(&env, "https://github.com/example/v2");

        client.register_source(&target, &url_v1);
        client.register_source(&target, &url_v2);

        assert_eq!(client.get_source(&target), Some(url_v2));
    }

    #[test]
    fn test_multiple_contracts_registered_independently() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(SourceRegistry, ());
        let client = SourceRegistryClient::new(&env, &contract_id);

        let contract_a = Address::generate(&env);
        let contract_b = Address::generate(&env);

        let url_a = String::from_str(&env, "https://github.com/example/contract-a");
        let url_b = String::from_str(&env, "https://github.com/example/contract-b");

        client.register_source(&contract_a, &url_a);
        client.register_source(&contract_b, &url_b);

        assert_eq!(client.get_source(&contract_a), Some(url_a));
        assert_eq!(client.get_source(&contract_b), Some(url_b));
    }

    #[test]
    fn test_unauthorized_cannot_register() {
        let env = Env::default();
        // Do NOT mock all auths — let auth checks run

        let contract_id = env.register(SourceRegistry, ());
        let client = SourceRegistryClient::new(&env, &contract_id);

        let target = Address::generate(&env);
        let url = String::from_str(&env, "https://github.com/attacker/hijack");

        // Calling register_source without the target's auth should panic
        let result = client.try_register_source(&target, &url);
        assert!(result.is_err());
    }
}