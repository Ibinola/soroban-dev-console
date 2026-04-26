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
