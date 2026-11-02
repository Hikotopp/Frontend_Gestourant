const registrationPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,72}$/;

export function isValidRegistrationPassword(password) {
  return typeof password === 'string' && registrationPasswordPattern.test(password);
}
