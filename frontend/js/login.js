function enableLoginButton(token){
    const button = document.getElementById('loginButton');
    const input = document.getElementById('cfTurnstileResponse');
    if(button) button.disabled = false;
    if(input) input.value = token;
}

window.addEventListener('load', () => {
    const form = document.querySelector('form');
    const button = document.getElementById('loginButton');
    if(form){
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if(button && button.disabled) return;
            form.submit();
        });
    }
});
