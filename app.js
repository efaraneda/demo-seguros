function getOneSignalId(callback) {
    if (!window.OneSignalDeferred) {
        callback(null);
        return;
    }

    OneSignalDeferred.push(function(OneSignal) {
        try {
            const id = OneSignal.User?.PushSubscription?.id || null;
            callback(id);
        } catch (e) {
            callback(null);
        }
    });
}

// DataLayer para Google Tag Manager
window.dataLayer = window.dataLayer || [];

// Función helper para push al dataLayer
function pushToDataLayer(event, data) {
    window.dataLayer.push({
        event: event,
        ...data
    });
    console.log('DataLayer Event:', event, data);

    if (event === 'renewal_interest') {
        OneSignal.User.addTag('status_comercial', 'renewal_interest');
    }

    if (event === 'payment_initiated') {
        OneSignal.User.addTag('status_comercial', 'payment_initiated');
    }
    getOneSignalId((id) => {
    analytics.track(event, {
        onesignal_device: id
    });
});
}

// Configuración y constantes
const CONFIG = {
    STORAGE_KEY: 'aseguramx_client',
    BASE_PREMIUM: 3500
};

// Aplicación principal
const app = {
    currentStep: 1,
    clientData: null,
    isReturningClient: false,
    discountCode: null,
    discountPercentage: 0,

    init() {
        this.attachEventListeners();
    },

    // Event listeners
    attachEventListeners() {
        const form = document.getElementById('identification-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleIdentificationSubmit();
            });
        }

        const curpInput = document.getElementById('curp-rfc');
        if (curpInput) {
            curpInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        const discountInput = document.getElementById('discount-code');
        if (discountInput) {
            discountInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
                this.validateDiscountCode(e.target.value);
            });
        }
    },

    // Iniciar proceso
    startProcess() {
        document.getElementById('hero-section').style.display = 'none';
        document.getElementById('form-container').style.display = 'block';

        // Siempre mostrar campo de descuento (demo)
        document.getElementById('discount-code-group').style.display = 'block';

        pushToDataLayer('process_started', {
            timestamp: new Date().toISOString()
        });
    },

    // Validar código (DEMO: cualquiera funciona)
    validateDiscountCode(code) {
        const discountAlert = document.getElementById('discount-alert');
        const discountMessage = document.getElementById('discount-message');

        if (code.length === 0) {
            discountAlert.style.display = 'none';
            this.discountCode = null;
            this.discountPercentage = 0;
            return;
        }

        const randomDiscount = Math.floor(Math.random() * 21) + 5; // 5% - 25%

        this.discountCode = code;
        this.discountPercentage = randomDiscount;

        discountMessage.textContent = `Código aplicado: ${randomDiscount}% de descuento`;
        discountAlert.style.display = 'flex';
        discountAlert.className = 'alert alert-success';

        pushToDataLayer('discount_code_applied', {
            code: code,
            discount_percentage: randomDiscount
        });
    },

    // Validación CURP/RFC
    validateCURP(curp) {
        const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
        const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}$/;

        return curpRegex.test(curp) || rfcRegex.test(curp);
    },

    // Submit identificación
    handleIdentificationSubmit() {
        const curpValue = document.getElementById('curp-rfc').value.trim();

        if (!this.validateCURP(curpValue)) {
            alert('Por favor ingresa un CURP o RFC válido');
            return;
        }
        analytics.identify(curpValue);

        const savedClient = localStorage.getItem(CONFIG.STORAGE_KEY);
        let isSameClient = false;

        if (savedClient) {
            const parsed = JSON.parse(savedClient);
            if (parsed.curp === curpValue) {
                isSameClient = true;
            }
        }

        // Guardar siempre el último CURP
        this.clientData = {
            curp: curpValue,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.clientData));

        this.isReturningClient = isSameClient;

        if (isSameClient) {
            pushToDataLayer('payment_ready', {
                client_id: curpValue
            });
        } else {
            pushToDataLayer('quote_initiated', {
                client_id: curpValue,
                discount_percentage: this.discountPercentage
            });
        }

        this.goToStep(2);
    },

    // Navegación
    goToStep(step) {
        this.currentStep = step;

        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');

        document.querySelectorAll('.progress-step').forEach((s, index) => {
            if (index < step) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });

        if (step === 2) {
            this.loadSummary();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Resumen
    loadSummary() {
    const paymentButton = document.getElementById('payment-button');

    let basePremium = 0;
    let discountAmount = 0;
    let totalAmount = 0;

    // Datos básicos
    document.getElementById('client-curp').textContent = this.clientData.curp;
    document.getElementById('policy-type').textContent = this.isReturningClient
        ? 'Renovación'
        : 'Nueva póliza';

    if (this.isReturningClient) {
        // 👉 CLIENTE RECURRENTE → PAGO
        paymentButton.disabled = false;
        paymentButton.textContent = 'Proceder al pago';
        paymentButton.onclick = () => this.processPayment();

        basePremium = CONFIG.BASE_PREMIUM;
        discountAmount = (basePremium * this.discountPercentage) / 100;
        totalAmount = basePremium - discountAmount;

        document.getElementById('base-premium').textContent = this.formatCurrency(basePremium);
        document.getElementById('total-amount').textContent = this.formatCurrency(totalAmount);

    } else {
        // 👉 CLIENTE NUEVO → COTIZACIÓN
        paymentButton.disabled = false;
        paymentButton.textContent = 'Enviar cotización';
        paymentButton.onclick = () => this.sendQuote();

        document.getElementById('base-premium').textContent = 'Requiere evaluación';
        document.getElementById('total-amount').textContent = 'Requiere evaluación';
    }

    // Mostrar descuento (solo si aplica y hay monto)
    if (this.discountPercentage > 0 && this.isReturningClient) {
        document.getElementById('discount-row').style.display = 'flex';
        document.getElementById('discount-amount').textContent =
            `- ${this.formatCurrency(discountAmount)} (${this.discountPercentage}%)`;
    } else {
        document.getElementById('discount-row').style.display = 'none';
    }

    // DataLayer
    pushToDataLayer('summary_viewed', {
        client_id: this.clientData.curp,
        policy_type: this.isReturningClient ? 'renewal' : 'new',
        total_amount: totalAmount,
        discount_percentage: this.discountPercentage
    });
},
sendQuote() {
    pushToDataLayer('quote_submitted', {
        client_id: this.clientData.curp,
        discount_code: this.discountCode || null
    });

    // Simula mismo flujo visual que pago
    document.getElementById('form-container').style.display = 'none';
    document.getElementById('loading-screen').style.display = 'flex';

    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';

        document.getElementById('success-message').textContent =
            'Tu cotización fue enviada. Te contactaremos pronto';

        document.getElementById('confirmation-number').textContent = 'COT-' + Date.now();
        document.getElementById('paid-amount').textContent = 'N/A';
    }, 2000);
},
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    },

    goBack() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    },

    processPayment() {
    if (!this.isReturningClient) {
        alert('Primero debes cotizar con este CURP antes de pagar');
        return;
    }
        const basePremium = CONFIG.BASE_PREMIUM;
        const discountAmount = (basePremium * this.discountPercentage) / 100;
        const totalAmount = basePremium - discountAmount;

        pushToDataLayer('payment_initiated', {
            client_id: this.clientData.curp,
            amount: totalAmount,
            policy_type: this.isReturningClient ? 'renewal' : 'new'
        });

        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'flex';

        setTimeout(() => {
            this.completePayment(totalAmount);
        }, 2000);
    },

    completePayment(amount) {
        const confirmationNumber = this.generateConfirmationNumber();

        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';

        document.getElementById('confirmation-number').textContent = confirmationNumber;
        document.getElementById('paid-amount').textContent = this.formatCurrency(amount);

        document.getElementById('success-message').textContent =
            this.isReturningClient
                ? 'Tu póliza ha sido renovada exitosamente'
                : 'Tu nueva póliza ha sido procesada correctamente';

        pushToDataLayer('payment_completed', {
            client_id: this.clientData.curp,
            amount: amount,
            discount_percentage: this.discountPercentage,
            discount_code: this.discountCode || null
        });
    },

    generateConfirmationNumber() {
        return `ASG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    },

    reset() {
        this.currentStep = 1;
        this.discountCode = null;
        this.discountPercentage = 0;

        document.getElementById('success-screen').style.display = 'none';
        document.getElementById('hero-section').style.display = 'block';

        document.getElementById('identification-form').reset();
        document.getElementById('discount-alert').style.display = 'none';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Init
document.addEventListener('DOMContentLoaded', () => {
    app.init();

    pushToDataLayer('page_loaded', {
        page_title: 'AseguraMX - Cotización',
        page_path: window.location.pathname
    });
});

window.app = app;

