#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

#[contract]
pub struct AuthTester;

#[contractimpl]
impl AuthTester {
    /// A function that requires authorization from two different addresses.
    /// This is useful for testing how the UI handles multiple required authorizations.
    pub fn multi_auth(_env: Env, user1: Address, user2: Address) {
        user1.require_auth();
        user2.require_auth();
    }
}
