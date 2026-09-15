(function () {
		/* =========================================================
ВАЛИДАЦИЯ ПОЛЕЙ (и для files/php/send-form.php) — Правило задаётся атрибутом data-js-validate="email|phone|text", границы длины для text — data-js-minlength/data-js-maxlength.
!!! ВАЖНО $KNOWN_FIELDS - внести в PHP все свои поля!!!
========================================================= */

	document.addEventListener("DOMContentLoaded", function () {
		const docEl = document.documentElement;
		const bodyEl = document.body;

		let scrollLockY = 0;
		let isScrollLocked = false;

		function refreshScrollLock() {
			const shouldLock = !!document.querySelector(".modal-overlay.open");

			if (shouldLock && !isScrollLocked) {
				scrollLockY = window.scrollY || window.pageYOffset || docEl.scrollTop || 0;

				/* ширина скроллбара */
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

				/* восстанавливаем позицию мгновенно, без анимации */
				const prevBehavior = docEl.style.scrollBehavior;
				docEl.style.scrollBehavior = "auto";
				window.scrollTo(0, scrollLockY);
				docEl.style.scrollBehavior = prevBehavior || "";

				docEl.style.setProperty("--scrollbar-comp", "0px");
				isScrollLocked = false;
			}
		}


		/* =================== УНИВЕРСАЛЬНАЯ СИСТЕМА МОДАЛОК ================= */
		const M_PREFIX = "data-m_";
		const INPUT_PREFIX = "data-input_";

		function openModal(modal) {
			modal.classList.add("open");

			/* таймер антиспама стартует с открытия формы */
			// const form = modal.querySelector("form");
			// if (form) startFormTimer(form);

			refreshScrollLock();
		}

		function closeModal(modal) {
			modal.classList.remove("open");
			refreshScrollLock();
			const success = modal.querySelector(".modal-success");
			if (success) success.classList.remove("show");
			const form = modal.querySelector("form");
			if (form) form.dataset.fillStart = ""; // при повторном открытии таймер стартует заново
		}

		/* ============= Перенос данных с кнопки в модалку =========== */
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
		/* ======= Обработчик кликов ======= */
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
		/* ========= закрытие по Escape ======== */
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape") {
				document.querySelectorAll(".modal-overlay.open").forEach(function (m) {
					closeModal(m);
				});
			}
		});

		/* ========= МАСКА ТЕЛЕФОНА (IMask) — +7 (999) 999-99-99 ============= */
		document.querySelectorAll(".js-phone-mask").forEach(function (input) {
			if (window.IMask) {
				IMask(input, { mask: "+{7} (000) 000-00-00" });
			}
		});

		/* ============= UTM-МЕТКИ ============ */
		const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
		(function captureUTM() {
			const params = new URLSearchParams(window.location.search);
			UTM_KEYS.forEach(function (k) {
				const v = params.get(k);
				if (v) {
					try {
						sessionStorage.setItem("fp_" + k, v);
					} catch (e) { }
				}
			});
		})();
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

		/* ============== КАСТОМНЫЙ SELECT -> скрытый input с data-js-label =============== */
		document.querySelectorAll(".js-select").forEach(function (sel) {
			const trigger = sel.querySelector(".js-select-trigger");
			const valueEl = sel.querySelector(".js-select-value");

			// Сохраняем исходный текст, чтобы вернуть его при очистке формы
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
					options.forEach(function (o) {
						o.classList.remove("active");
					});
					opt.classList.add("active");
					valueEl.textContent = opt.textContent.trim();
					if (hiddenInput) {
						hiddenInput.value = opt.dataset.value;
					}
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

		/* =========================================================
ВАЛИДАЦИЯ ПОЛЕЙ (и для send-form.php) — Правило задаётся атрибутом data-js-validate="email|phone|text", границы длины для text — data-js-minlength/data-js-maxlength.
========================================================= */
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
				/* свободный текст: только русский (плюс базовая пунктуация и переносы строк), без ссылок, ограничение по длине — для полей "сообщение"/"вопрос" */
				const maxLen = parseInt(input.dataset.jsMaxlength || "500", 10);
				if (value.length > maxLen) return "Не более " + maxLen + " символов";
				if (/(https?:\/\/|www\.|[a-zA-Zа-яА-ЯёЁ0-9-]+\.(ru|com|рф|net|org|io|me))/i.test(value)) return "Ссылки в этом поле не разрешены";
				if (!/^[а-яА-ЯёЁ0-9\s.,!?()\-:;\n]+$/.test(value)) return "Разрешены только русские буквы и знаки препинания";
			}
			return null;
		}

		/* ========= Показать ошибки ========= */
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

		/* ========= ТАЙМЕР ЗАПОЛНЕНИЯ (антиспам) ============== */
		function startFormTimer(form) {
			if (!form.dataset.fillStart) {
				form.dataset.fillStart = String(Date.now());
			}
		}

		/* =========================================================
СБОРКА ПОЛЕЗНОЙ НАГРУЗКИ ДЛЯ send-form.php
========================================================= */
		/* ========= разметка HTML-формы в JSON, который потом улетает на send-form.php ========= */
		function collectFormPayload(form) {
			/* ========= Находит внутри конкретной формы её honeypot-поле — по атрибуту, а не по имени, потому что имя может быть любым (extra_contact и т.п.) ========= */
			const honeypotInput = form.querySelector('[data-js-validate="honeypot"]');
			/* ========= антиспам-таймер ========= */
			const startedAt = parseInt(form.dataset.fillStart || "0", 10);
			const timer = startedAt ? (Date.now() - startedAt) / 1000 : 0;

			const fields = [];
			const seenRadioGroups = {};

			/* ========= все данные формы целиком, включая обычные технические поля (honeypot сюда входит) ========= */
			form.querySelectorAll("[name]").forEach(function (input) {
				if (input.dataset.jsValidate === "honeypot") return;
				/* ========= Определение значения ========= */
				const name = input.name;
				let value;

				/* ========= что написано в value у checkbox или radio ========= */
				if (input.type === "checkbox") {
					value = input.checked ? input.value || "да" : "";
				} else if (input.type === "radio") {
					if (seenRadioGroups[name]) return;
					seenRadioGroups[name] = true;
					const checked = form.querySelector('input[name="' + name + '"]:checked');
					value = checked ? checked.value : "";
				} else {
					/* ========= Всё остальное (текст, телефон, email, textarea, скрытые поля) ========= */
					value = input.value;
				}
				/* ========= Складываем в объект ========= */
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

		/* =================== СЧЁТЧИК СИМВОЛОВ для textarea с ограничением (data-js-maxlength) - надпись «120 / 500» под полем «Ваш вопрос», которая меняется по мере печати. Только <textarea>, у которых есть атрибут data-js-maxlength ==================== */
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

		/* =========================================================
ИНИЦИАЛИЗАЦИЯ ФОРМЫ: валидация + запрос на send-form.php
========================================================= */
		function initForm(form) {
			/* ========= валидация и счётчик символов ========= */
			bindLiveValidation(form);
			bindCharCounter(form);
			/* форма вне модалки — часы запускаем сразу; форма в модалке — см. openModal() */
			// if (!form.closest(".modal-overlay")) {
			// 	startFormTimer(form);
			// }
			startFormTimer(form);

			const submitBtn = form.querySelector('button[type="submit"]');
			const submitLabel = submitBtn ? submitBtn.textContent : "";
			if (submitBtn) {
				submitBtn.dataset.defaultLabel = submitLabel;
			}

			form.addEventListener("submit", function (e) {
				e.preventDefault();

				/* защита от повторной отправки (от нервного двойного клика по кнопке) */
				if (form.dataset.submitting === "1") return;

				/* подставляет в скрытые поля значения UTM из sessionStorage */
				labelUTMFields(form);

				/* Валидация перед отправкой: проверить прямо сейчас, все поля разом. Если хоть одно не проходит — valid становится false. Если что-то не так — ставят фокус именно на это первое проблемное поле (чтобы пользователь сразу видел, откуда начинать исправлять) */
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
				/* Подготовка к отправке */
				const payload = collectFormPayload(form);

				form.dataset.submitting = "1";
				if (submitBtn) {
					submitBtn.disabled = true;
					submitBtn.textContent = "Отправляем…";
				}
				/* POST-запрос с JSON-телом на наш PHP-обработчик */
				fetch("files/php/send-form.php", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				})
					/* Обработка ответа */
					.then(function (res) {
						return res.json();
					})
					.then(function (res) {
						if (res.ok) {
							/* редирект имеет приоритет: если у формы задан data-js-form-redirect с непустым значением — уходим на эту страницу. Пустое значение или отсутствие атрибута — показываем блок успеха рядом с формой (внутри модалки — тот же блок закрывает и саму модалку, вне модалки — просто прячется обратно). */
							const redirectUrl = form.dataset.jsFormRedirect;
							if (redirectUrl) {
								window.location.href = redirectUrl;
								return;
							}

							const modal = form.closest(".modal-overlay");
							/* блок успеха ищем как соседа формы — работает и в модалке (modal-box), и в обычной секции (например .ask-card) */
							const success = form.parentElement ? form.parentElement.querySelector(".modal-success") : null;

							function finishReset() {
								form.reset();
								form.dataset.fillStart = "";
								form.querySelectorAll("textarea[data-js-maxlength]").forEach(function (ta) {
									ta.dispatchEvent(new Event("input"));
								});
								// Сбрасываем текст кастомных селектов к исходному
								form.querySelectorAll(".js-select .js-select-value").forEach(function (valueEl) {
									if (valueEl.dataset.defaultText) {
										valueEl.textContent = valueEl.dataset.defaultText;
									}
								});
							}

							/* показывается success на 1.8 секунды, потом прячется, закрывается модалка (если она есть) и сбрасывается форма. Если блока успеха вообще нет в разметке — грубый запасной alert() */
							if (success) {
								success.classList.add("show");
								setTimeout(function () {
									success.classList.remove("show");
									if (modal) {
										closeModal(modal);
									}
									finishReset();
								}, 1800);
							} else {
								finishReset();
								alert(res.message || "Спасибо! Мы свяжемся с вами в ближайшее время.");
							}
						} else if (res.errors) {
							/* когда PHP нашёл проблему, которую JS не поймал — сервер возвращает объект {имя_поля: текст_ошибки} */
							Object.keys(res.errors).forEach(function (name) {
								const input = form.querySelector('[name="' + name + '"]');
								if (input) showFieldError(input, res.errors[name]);
							});
						} else {
							/* общая ошибка без деталей по полям */
							alert(res.message || "Не удалось отправить заявку. Попробуйте позвонить нам напрямую.");
						}
					})
					.catch(function () {
						alert("Не удалось отправить заявку. Проверьте соединение или позвоните нам напрямую.");
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
		document.querySelectorAll("[data-js-form]").forEach(initForm);
	});
})();