(function () {
	/* ==========================================================================
	   МОДУЛЬ ВАЛИДАЦИИ ФОРМ И МОДАЛЬНЫХ ОКНО (AvtoselfFormsValidation)
	   ========================================================================== */

	const docEl = document.documentElement;
	const bodyEl = document.body;

	let scrollLockY = 0;
	let isScrollLocked = false;

	function refreshScrollLock() {
		const shouldLock = !!document.querySelector(".modal-overlay.open");

		if (shouldLock && !isScrollLocked) {
			scrollLockY = window.scrollY || window.pageYOffset || docEl.scrollTop || 0;
			const scrollbarWidth = window.innerWidth - docEl.clientWidth;

			docEl.style.setProperty("--scrollbar-comp", scrollbarWidth + "px");
			docEl.classList.add("scroll-lock");

			bodyEl.style.position = "fixed";
			bodyEl.style.top = -scrollLockY + "px";
			bodyEl.style.left = "0";
			bodyEl.style.right = "0";
			bodyEl.style.width = "100%";

			isScrollLocked = true;
		} else if (!shouldLock && isScrollLocked) {
			docEl.classList.remove("scroll-lock");

			bodyEl.style.position = "";
			bodyEl.style.top = "";
			bodyEl.style.left = "";
			bodyEl.style.right = "";
			bodyEl.style.width = "";

			const prevBehavior = docEl.style.scrollBehavior;
			docEl.style.scrollBehavior = "auto";
			window.scrollTo(0, scrollLockY);
			docEl.style.scrollBehavior = prevBehavior || "";

			docEl.style.setProperty("--scrollbar-comp", "0px");
			isScrollLocked = false;
		}
	}

	const M_PREFIX = "data-m_";
	const INPUT_PREFIX = "data-input_";

	function openModal(modal) {
		modal.classList.add("open");
		refreshScrollLock();
	}

	function closeModal(modal) {
		modal.classList.remove("open");
		refreshScrollLock();
		const success = modal.querySelector(".modal-success");
		if (success) success.classList.remove("show");
		
		modal.querySelectorAll("form").forEach(function (form) {
			form.dataset.fillStart = "";
		});
	}

	function populateModalFromOpener(modal, btn) {
		modal.querySelectorAll("[data-modal_submit_label]").forEach(function (el) {
			if (el.dataset.defaultLabel) el.textContent = el.dataset.defaultLabel;
		});
		Array.from(btn.attributes).forEach(function (attr) {
			if (attr.name.indexOf(M_PREFIX) === 0) {
				const key = attr.name.slice(M_PREFIX.length);
				modal.querySelectorAll("[data-modal_" + key + "]").forEach(function (t) {
					t.textContent = attr.value;
				});
			} else if (attr.name.indexOf(INPUT_PREFIX) === 0) {
				const key2 = attr.name.slice(INPUT_PREFIX.length);
				modal.querySelectorAll('[name="' + key2 + '"]').forEach(function (inp) {
					inp.value = attr.value;
				});
			}
		});
	}

	function validateInput(input) {
		const rule = input.dataset.jsValidate;
		const required = input.hasAttribute("data-js-required");

		if (input.type === "checkbox") {
			if (required && !input.checked) return "Отметьте это поле";
			return null;
		}

		const value = input.value.trim();
		if (required && value === "") return "Поле обязательно для заполнения";
		if (!rule || value === "") return null;

		if (rule === "email") {
			if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) return "Введите корректный email";
		} else if (rule === "phone") {
			const digits = value.replace(/\D/g, "");
			if (digits.length !== 11) return "Введите телефон полностью";
		} else if (rule === "text") {
			const min = parseInt(input.dataset.jsMinlength || "1", 10);
			const max = parseInt(input.dataset.jsMaxlength || "200", 10);
			if (value.length < min || value.length > max) return "От " + min + " до " + max + " символов";
			if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(value)) return "Только буквы, пробел и дефис";
		} else if (rule === "message") {
			const maxLen = parseInt(input.dataset.jsMaxlength || "500", 10);
			if (value.length > maxLen) return "Не более " + maxLen + " символов";
			if (/(https?:\/\/|www\.|[a-zA-Zа-яА-ЯёЁ0-9-]+\.(ru|com|рф|net|org|io|me))/i.test(value)) return "Ссылки в этом поле не разрешены";
			if (!/^[а-яА-ЯёЁ0-9\s.,!?()\-:;\n]+$/.test(value)) return "Разрешены только русские буквы и знаки препинания";
		}
		return null;
	}

	function showFieldError(input, message) {
		const wrap = input.closest(".field");
		if (!wrap) return;
		const errEl = wrap.querySelector(".field-error");
		if (!errEl) return;
		input.classList.toggle("field-invalid", !!message);
		if (message) {
			errEl.textContent = message;
			errEl.classList.add("show");
		} else {
			errEl.classList.remove("show");
		}
	}

	function bindLiveValidation(form) {
		form.querySelectorAll("[data-js-required], [data-js-validate]").forEach(function (input) {
			if (input.dataset.jsValidate === "honeypot") return;
			const handler = function () {
				showFieldError(input, validateInput(input));
			};
			input.addEventListener("blur", handler);
			input.addEventListener("input", function () {
				const wrap = input.closest(".field");
				if (wrap && wrap.querySelector(".field-error.show")) handler();
			});
			input.addEventListener("change", handler);
		});
	}

	function startFormTimer(form) {
		if (!form.dataset.fillStart) {
			form.dataset.fillStart = String(Date.now());
		}
	}

	const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
	
	function captureUTM() {
		const params = new URLSearchParams(window.location.search);
		UTM_KEYS.forEach(function (k) {
			const v = params.get(k);
			if (v) {
				try {
					sessionStorage.setItem("fp_" + k, v);
				} catch (e) { }
			}
		});
	}

	function labelUTMFields(form) {
		UTM_KEYS.forEach(function (k) {
			const input = form.querySelector('[name="' + k + '"]');
			if (!input) return;
			let v = null;
			try {
				v = sessionStorage.getItem("fp_" + k);
			} catch (e) { }
			input.value = v || "";
		});
	}

	function collectFormPayload(form) {
		const honeypotInput = form.querySelector('[data-js-validate="honeypot"]');
		const startedAt = parseInt(form.dataset.fillStart || "0", 10);
		const timer = startedAt ? (Date.now() - startedAt) / 1000 : 0;

		const fields = [];
		const seenRadioGroups = {};

		form.querySelectorAll("[name]").forEach(function (input) {
			if (input.dataset.jsValidate === "honeypot") return;
			const name = input.name;
			let value;

			if (input.type === "checkbox") {
				value = input.checked ? input.value || "да" : "";
			} else if (input.type === "radio") {
				if (seenRadioGroups[name]) return;
				seenRadioGroups[name] = true;
				const checked = form.querySelector('input[name="' + name + '"]:checked');
				value = checked ? checked.value : "";
			} else {
				value = input.value;
			}
			fields.push({
				name: name,
				value: value,
				label: input.dataset.jsLabel || "",
				required: input.hasAttribute("data-js-required"),
				rule: input.dataset.jsValidate || "",
				minlength: input.dataset.jsMinlength || "",
				maxlength: input.dataset.jsMaxlength || "",
			});
		});

		return { honeypot: honeypotInput ? honeypotInput.value : "", timer: timer, fields: fields };
	}

	function bindCharCounter(form) {
		form.querySelectorAll("textarea[data-js-maxlength]").forEach(function (ta) {
			const field = ta.closest(".field");
			const counter = field ? field.querySelector(".char-counter") : null;
			if (!counter) return;
			function update() {
				const max = parseInt(ta.dataset.jsMaxlength || "500", 10);
				const len = ta.value.length;
				counter.textContent = len + " / " + max;
				counter.classList.toggle("near-limit", len > max * 0.95);
			}
			ta.addEventListener("input", update);
			update();
		});
	}

	function initForm(form) {
		bindLiveValidation(form);
		bindCharCounter(form);
		startFormTimer(form);

		const submitBtn = form.querySelector('button[type="submit"]');
		const submitLabel = submitBtn ? submitBtn.textContent : "";
		if (submitBtn) {
			submitBtn.dataset.defaultLabel = submitLabel;
		}

		form.addEventListener("submit", function (e) {
			e.preventDefault();
			if (form.dataset.submitting === "1") return;

			labelUTMFields(form);

			let valid = true;
			let firstInvalid = null;
			form.querySelectorAll("[data-js-required], [data-js-validate]").forEach(function (input) {
				if (input.dataset.jsValidate === "honeypot") return;
				const err = validateInput(input);
				showFieldError(input, err);
				if (err) {
					valid = false;
					if (!firstInvalid) firstInvalid = input;
				}
			});
			if (!valid) {
				if (firstInvalid) firstInvalid.focus();
				return;
			}

			const payload = collectFormPayload(form);
			form.dataset.submitting = "1";
			if (submitBtn) {
				submitBtn.disabled = true;
				submitBtn.textContent = "Отправляем…";
			}

			fetch("files/php/send-form.php", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})
				.then(function (res) { return res.json(); })
				.then(function (res) {
					if (res.ok) {
						const redirectUrl = form.dataset.jsFormRedirect;
						if (redirectUrl) {
							window.location.href = redirectUrl;
							return;
						}

						const modal = form.closest(".modal-overlay");
						const success = form.parentElement ? form.parentElement.querySelector(".modal-success") : null;

						function finishReset() {
							form.reset();
							form.dataset.fillStart = "";
							form.querySelectorAll("textarea[data-js-maxlength]").forEach(function (ta) {
								ta.dispatchEvent(new Event("input"));
							});
							form.querySelectorAll(".js-select .js-select-value").forEach(function (valueEl) {
								if (valueEl.dataset.defaultText) {
									valueEl.textContent = valueEl.dataset.defaultText;
								}
							});
						}

						if (success) {
							success.classList.add("show");
							setTimeout(function () {
								success.classList.remove("show");
								if (modal) closeModal(modal);
								finishReset();
							}, 1800);
						} else {
							finishReset();
							alert(res.message || "Спасибо! Мы свяжемся с вами в ближайшее время.");
}
} else if (res.errors) {
Object.keys(res.errors).forEach(function (name) {
const input = form.querySelector('[name="' + name + '"]');
if (input) showFieldError(input, res.errors[name]);
});
} else {
alert(res.message || "Не удалось отправить заявку.");
}
})
.catch(function () {
alert("Проверьте соединение с интернетом.");
})
.finally(function () {
form.dataset.submitting = "";
if (submitBtn) {
submitBtn.disabled = false;
submitBtn.textContent = submitLabel;
}
});
});
}
function initSelects() {
document.querySelectorAll(".js-select").forEach(function (sel) {
const trigger = sel.querySelector(".js-select-trigger");
const valueEl = sel.querySelector(".js-select-value");
if (valueEl && !valueEl.dataset.defaultText) {
valueEl.dataset.defaultText = valueEl.textContent.trim();
}
const hiddenInput = sel.parentElement.querySelector("input[hidden]");
const options = sel.querySelectorAll(".js-select-options li");
trigger.addEventListener("click", function (e) {
e.stopPropagation();
document.querySelectorAll(".js-select.open").forEach(function (o) {
if (o !== sel) o.classList.remove("open");
});
sel.classList.toggle("open");
});
options.forEach(function (opt) {
if (opt.hasAttribute("data-disabled")) return;
opt.addEventListener("click", function () {
options.forEach(function (o) { o.classList.remove("active"); });
opt.classList.add("active");
valueEl.textContent = opt.textContent.trim();
if (hiddenInput) hiddenInput.value = opt.dataset.value;
sel.classList.remove("open");
});
});
});
document.addEventListener("click", function (e) {
if (!e.target.closest(".js-select")) {
document.querySelectorAll(".js-select.open").forEach(function (s) {
s.classList.remove("open");
});
}
});
}
function bindGlobalListeners() {
document.addEventListener("click", function (e) {
const opener = e.target.closest("[data-modal-target]");
if (opener) {
const modal = document.querySelector(opener.getAttribute("data-modal-target"));
if (modal) {
populateModalFromOpener(modal, opener);
openModal(modal);
}
return;
}
const closer = e.target.closest("[data-modal-close]");
if (closer) {
const m = closer.closest(".modal-overlay");
if (m) closeModal(m);
return;
}
if (e.target.classList && e.target.classList.contains("modal-overlay")) {
closeModal(e.target);
}
});
document.addEventListener("keydown", function (e) {
if (e.key === "Escape") {
document.querySelectorAll(".modal-overlay.open").forEach(function (m) {
closeModal(m);
});
}
});
document.querySelectorAll(".js-phone-mask").forEach(function (input) {
if (window.IMask) IMask(input, { mask: "+{7} (000) 000-00-00" });
});
}
// Главный объект-модуль, который отдаем наружу
const AvtoselfFormsValidation = {
init: function () {
captureUTM();
initSelects();
bindGlobalListeners();
document.querySelectorAll("[data-js-form]").forEach(initForm);
}
};
// Экспортируем в window
window.AvtoselfFormsValidation = AvtoselfFormsValidation;
})();

