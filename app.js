// DataLayer para Google Tag Manager
window.dataLayer = window.dataLayer || [];

// Función helper para push al dataLayer
function pushToDataLayer(event, data) {
    window.dataLayer.push({
        event: event,
        ...data
    });
    console.log('DataLayer Event:', event, data);

    if (event ==='renewal_interest'){
        
        // Add a single tag
    OneSignal.User.addTag('status_comercial', 'renewal_interest');
    }
    if (event ==='payment_initiated'){
        
        // Add a single tag
    OneSignal.User.addTag('status_comercial', 'payment_initiated');
    }
}

// Configuración y constantes
const CONFIG = {
    STORAGE_KEY: 'aseguramx_client',
    DISCOUNT_CODES: {
        'RENUEVA2024': 15,
        'CLIENTE2024': 10,
        'NUEVO2024': 5
    },
    RENEWAL_DISCOUNT: 20, // 20% descuento automático para renovaciones
    BASE_PREMIUM: 3500, // Prima base en MXN
};

// Aplicación principal
const app = {
    currentStep: 1,
    clientData: null,
    isReturningClient: false,
    discountCode: null,
    discountPercentage: 0,

    init() {
        this.checkReturningClient();
        this.attachEventListeners();
    },

    // Verificar si es cliente recurrente
    checkReturningClient() {
        const savedClient = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (savedClient) {
            this.isReturningClient = true;
            this.clientData = JSON.parse(savedClient);
        }
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

        // Formatear CURP/RFC mientras escribe
        const curpInput = document.getElementById('curp-rfc');
        if (curpInput) {
            curpInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });
        }

        // Validar código de descuento
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
        
        // Mostrar campo de código de descuento si es nuevo cliente
        if (!this.isReturningClient) {
            document.getElementById('discount-code-group').style.display = 'block';
        }

        // Cambiar textos según tipo de cliente
        if (this.isReturningClient) {
            document.getElementById('step-1-title').textContent = '¡Bienvenido de nuevo!';
            document.getElementById('step-1-subtitle').textContent = 'Verifica tu información para renovar';
            
            // Pre-llenar CURP si existe
            if (this.clientData && this.clientData.curp) {
                document.getElementById('curp-rfc').value = this.clientData.curp;
            }

            // Disparar evento DataLayer - Usuario recurrente
            pushToDataLayer('returning_client_started', {
                client_id: this.clientData?.curp || 'unknown',
                timestamp: new Date().toISOString()
            });
        } else {
            // Disparar evento DataLayer - Usuario nuevo
            pushToDataLayer('new_client_started', {
                timestamp: new Date().toISOString()
            });
        }
    },

    // Validar código de descuento
    validateDiscountCode(code) {
        const discountAlert = document.getElementById('discount-alert');
        const discountMessage = document.getElementById('discount-message');

        if (code.length === 0) {
            discountAlert.style.display = 'none';
            this.discountCode = null;
            this.discountPercentage = 0;
            return;
        }

        if (CONFIG.DISCOUNT_CODES[code]) {
            this.discountCode = code;
            this.discountPercentage = CONFIG.DISCOUNT_CODES[code];
            discountMessage.textContent = `¡Código válido! ${this.discountPercentage}% de descuento aplicado`;
            discountAlert.style.display = 'flex';
            discountAlert.className = 'alert alert-success';

            // Evento DataLayer - Código válido
            pushToDataLayer('discount_code_applied', {
                code: code,
                discount_percentage: this.discountPercentage
            });
        } else if (code.length >= 5) {
            discountMessage.textContent = 'Código inválido';
            discountAlert.style.display = 'flex';
            discountAlert.className = 'alert alert-error';
            discountAlert.style.background = '#FEE2E2';
            discountAlert.style.color = '#991B1B';
            discountAlert.style.borderColor = '#EF4444';
            this.discountCode = null;
            this.discountPercentage = 0;
        }
    },

    // Validar CURP/RFC (validación básica)
    validateCURP(curp) {
        // CURP: 18 caracteres
        const curpRegex = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
        // RFC: 12-13 caracteres
        const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{2,3}$/;

        return curpRegex.test(curp) || rfcRegex.test(curp);
    },

    // Manejar envío de identificación
    handleIdentificationSubmit() {
        const curpValue = document.getElementById('curp-rfc').value.trim();

        if (!this.validateCURP(curpValue)) {
            alert('Por favor ingresa un CURP o RFC válido');
            return;
        }

        // Guardar datos del cliente
        this.clientData = {
            curp: curpValue,
            timestamp: new Date().toISOString()
        };

        // Guardar en localStorage
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.clientData));

        // Determinar si el cliente ya existe (simulado)
        const wasReturningClient = this.isReturningClient;

        // Si es renovación, aplicar descuento automático
        if (wasReturningClient) {
            this.discountPercentage = CONFIG.RENEWAL_DISCOUNT;
            
            // Evento DataLayer - Renovación iniciada
            pushToDataLayer('renewal_interest', {
                client_id: curpValue,
                discount_percentage: this.discountPercentage
            });
        } else {
            // Evento DataLayer - Nueva cotización
            pushToDataLayer('quote_initiated', {
                client_id: curpValue,
                has_discount_code: !!this.discountCode,
                discount_percentage: this.discountPercentage
            });
        }

        this.goToStep(2);
    },

    // Navegar a un paso específico
    goToStep(step) {
        this.currentStep = step;

        // Actualizar pasos visuales
        document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
        document.getElementById(`step-${step}`).classList.add('active');

        // Actualizar barra de progreso
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

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // Cargar resumen de póliza
    loadSummary() {
        const basePremium = CONFIG.BASE_PREMIUM;
        const discountAmount = (basePremium * this.discountPercentage) / 100;
        const totalAmount = basePremium - discountAmount;

        // Actualizar valores en el DOM
        document.getElementById('client-curp').textContent = this.clientData.curp;
        document.getElementById('policy-type').textContent = this.isReturningClient ? 'Renovación' : 'Nueva póliza';
        document.getElementById('base-premium').textContent = this.formatCurrency(basePremium);
        document.getElementById('total-amount').textContent = this.formatCurrency(totalAmount);

        // Mostrar descuento si aplica
        if (this.discountPercentage > 0) {
            document.getElementById('discount-row').style.display = 'flex';
            document.getElementById('discount-amount').textContent = `- ${this.formatCurrency(discountAmount)} (${this.discountPercentage}%)`;
        } else {
            document.getElementById('discount-row').style.display = 'none';
        }

        // Evento DataLayer - Resumen visto
        pushToDataLayer('summary_viewed', {
            client_id: this.clientData.curp,
            policy_type: this.isReturningClient ? 'renewal' : 'new',
            base_premium: basePremium,
            discount_amount: discountAmount,
            total_amount: totalAmount,
            discount_percentage: this.discountPercentage
        });
    },

    // Formatear moneda
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    },

    // Volver al paso anterior
    goBack() {
        if (this.currentStep > 1) {
            this.goToStep(this.currentStep - 1);
        }
    },

    // Procesar pago
    processPayment() {
        const basePremium = CONFIG.BASE_PREMIUM;
        const discountAmount = (basePremium * this.discountPercentage) / 100;
        const totalAmount = basePremium - discountAmount;

        // Evento DataLayer - Pago iniciado
        pushToDataLayer('payment_initiated', {
            client_id: this.clientData.curp,
            amount: totalAmount,
            policy_type: this.isReturningClient ? 'renewal' : 'new'
        });

        // Ocultar formulario y mostrar loading
        document.getElementById('form-container').style.display = 'none';
        document.getElementById('loading-screen').style.display = 'flex';

        // Simular procesamiento (2 segundos)
        setTimeout(() => {
            this.completePayment(totalAmount);
        }, 2000);
    },

    // Completar pago
    completePayment(amount) {
        const confirmationNumber = this.generateConfirmationNumber();

        // Ocultar loading
        document.getElementById('loading-screen').style.display = 'none';

        // Mostrar pantalla de éxito
        document.getElementById('success-screen').style.display = 'block';
        document.getElementById('confirmation-number').textContent = confirmationNumber;
        document.getElementById('paid-amount').textContent = this.formatCurrency(amount);

        if (this.isReturningClient) {
            document.getElementById('success-message').textContent = 'Tu póliza ha sido renovada exitosamente';
        } else {
            document.getElementById('success-message').textContent = 'Tu nueva póliza ha sido procesada correctamente';
        }

        // Evento DataLayer - Pago completado
        pushToDataLayer('payment_completed', {
            client_id: this.clientData.curp,
            confirmation_number: confirmationNumber,
            amount: amount,
            policy_type: this.isReturningClient ? 'renewal' : 'new',
            discount_applied: this.discountPercentage > 0,
            discount_percentage: this.discountPercentage,
            discount_code: this.discountCode || null
        });

        // Evento de conversión
        pushToDataLayer('purchase', {
            transaction_id: confirmationNumber,
            value: amount,
            currency: 'MXN',
            items: [{
                item_id: 'POLICY_001',
                item_name: this.isReturningClient ? 'Renovación de Póliza' : 'Nueva Póliza',
                item_category: 'Seguros',
                price: amount,
                quantity: 1
            }]
        });
    },

    // Generar número de confirmación
    generateConfirmationNumber() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `ASG-${timestamp}-${random}`;
    },

    // Reiniciar aplicación
    reset() {
        // No limpiar localStorage para mantener al cliente como recurrente
        this.currentStep = 1;
        this.discountCode = null;
        this.discountPercentage = 0;

        // Ocultar success y mostrar hero
        document.getElementById('success-screen').style.display = 'none';
        document.getElementById('hero-section').style.display = 'block';

        // Limpiar formulario
        document.getElementById('identification-form').reset();
        document.getElementById('discount-alert').style.display = 'none';

        // Volver a verificar si es cliente recurrente
        this.checkReturningClient();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    app.init();

    // Evento DataLayer - Página cargada
    pushToDataLayer('page_loaded', {
        page_title: 'AseguraMX - Cotización',
        page_path: window.location.pathname,
        is_returning_client: app.isReturningClient
    });
});

// Exponer app globalmente para uso en onclick handlers
window.app = app;


