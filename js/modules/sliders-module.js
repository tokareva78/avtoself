(function () {
	const SlidersModule = {
		init: function () {
			// Проверяем, загружена ли библиотека Swiper и есть ли слайдер на странице
			if (typeof Swiper !== 'undefined' && document.querySelector('.js-reviews-slider')) {
				this.initReviewsSlider();
			}
			
			// Здесь можно будет добавлять проверки для других слайдеров (например, галереи)
			// if (typeof Swiper !== 'undefined' && document.querySelector('.js-gallery-slider')) { ... }
		},

		// Инициализация конкретного слайдера отзывов
		initReviewsSlider: function () {
			new Swiper('.js-reviews-slider', {
				slidesPerView: 1,
				spacing: 20,
				loop: true,
				// Подключаем стрелки навигации
				navigation: {
					nextEl: '.swiper-button-next',
					prevEl: '.swiper-button-prev',
				},
				// Подключаем точки (пагинацию)
				pagination: {
					el: '.swiper-pagination',
					clickable: true,
				},
				// Адаптив под разные экраны
				breakpoints: {
					576: {
						slidesPerView: 2,
					},
					992: {
						slidesPerView: 3,
					}
				}
			});
		}
	};

	// Экспортируем модуль в глобальную область видимости window
	window.SlidersModule = SlidersModule;
})();
