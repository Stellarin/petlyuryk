/**
 * Part of Petlyuryk by SweetPalma, all rights reserved.
 * This code is licensed under GNU GENERAL PUBLIC LICENSE, check LICENSE file for details.
 */

/**
 * Create fetcher method for data like "{ <key>: value, ... }".
 */
const createStatsFetch = (url, schema) => () => {
	return fetch(url)
		.then(res => res.json())
		.then(res => ({
			items: schema.map(field => ({
				...field,
				value: field.value(res.data),
			})),
		}));
};


/**
 * Create fetcher method for data like "{ { item }, { item }, { item }, ... }".
 */
const createTableFetch = (url, schema) => (search, offset, limit) => {
	const formatBoolean = (v) => typeof v !== 'boolean' ? v : (v ? '✔' : '✕');
	return fetch(url + '?' + new URLSearchParams({ search, offset, limit }))
		.then(res => res.json())
		.then(res => ({
			schema,
			total: res.data.total,
			items: res.data.docs.map(doc => {
				return schema.map(field => ({
					...field,
					value: formatBoolean(field.value(doc)),
				}));
			}),
		}));
};


/**
 * Page router.
 */
const pages = {
	stats: {
		title: 'Статистика',
		type: 'stats',
		fetchData: createStatsFetch('/api/chats/stats', [
			{ title: 'Повідомлень оброблено', value: doc => doc.messagesProcessed },
			{ title: 'Повідомлень надіслано', value: doc => doc.messagesResponded },
			{ title: 'Чатів всього', value: doc => doc.total },
			{ title: 'Чатів груп', value: doc => doc.totalGroup },
			{ title: 'Чатів неактивно', value: doc => doc.totalKicked },
			{ title: 'Чатів заглушено', value: doc => doc.totalMuted },
		]),
	},
	chats: {
		title: 'Чати',
		type: 'table',
		fetchData: createTableFetch('/api/chats', [
			{ title: 'ID', value: doc => doc.id, width: 155 },
			// { title: 'Створено', value: doc => doc.createdAt && new Date(doc.createdAt).toLocaleString("uk-UA"), width: 185 },
			{ title: 'Оновлено', value: doc => doc.updatedAt && new Date(doc.updatedAt).toLocaleString('uk-UA'), width: 185 },
			{ title: 'Назва чи юзернейм', value: doc => doc.title || doc.username },
			{ title: 'IN', value: doc => doc.messagesProcessed, width: 85 },
			{ title: 'OUT', value: doc => doc.messagesResponded, width: 85 },
			{ title: 'Mute?', value: doc => doc.isMuted, width: 85 },
			{ title: 'Kick?', value: doc => doc.isKicked, width: 85 },
		]),
	},
};


/**
 * Application loader.
 */
window.addEventListener('load', () => {
	document.getElementById('app').classList.add('loaded');
	new Vue({
		el: '#app',
		data: {
			error: undefined,
			loading: false,

			pages,
			pageName: undefined,
			page: undefined,

			data: {},
			dataSearch: '',
			dataOffset: 0,
			dataLimit: 0,
		},
		mounted() {
			this.parseHashRoute();
			this.$watch('dataLimit', this.fetchPageAndWriteHashRoute);
			this.$watch('dataOffset', this.fetchPageAndWriteHashRoute);
			this.$watch('dataSearch', () =>{
				this.fetchPageAndWriteHashRoute();
				this.dataOffset = 0;
			});
		},
		methods: {

			/**
			 * Parse page hash and conver it into pageName, offset and limit.
			 */
			parseHashRoute(hash = window.location.hash) {
				const parsedURL = new URL('http://hash/' + hash.slice(2));
				this.setPage(
					parsedURL.pathname.slice(1) || 'stats',
					parsedURL.searchParams.get('search') || undefined,
					parseInt(parsedURL.searchParams.get('offset')) || undefined,
					parseInt(parsedURL.searchParams.get('limit')) || undefined,
				);
			},

			/**
			 * Write pageName, offset and limit ot the page hash.
			 */
			writeHashRoute() {
				if (this.pageName && this.page) {
					const params = new URLSearchParams({ offset: this.dataOffset, limit: this.dataLimit, search: this.dataSearch });
					window.location.hash = '/' + this.pageName + (this.page.type !== 'stats' ? ('?' + params) : (''));
				} else {
					window.location.hash = '/';
				}
			},

			/**
			 * Route page.
			 */
			setPage(pageName, search = '', offset = 0, limit = 10) {

				// Update pagination:
				this.dataSearch = search;
				this.dataOffset = offset;
				this.dataLimit = limit;

				// Unknown page:
				if (!pageName || !this.pages[pageName]) {
					this.page = undefined;
					this.pageName = undefined;
				}

				// Known page:
				else {
					this.page = this.pages[pageName];
					this.pageName = pageName;
					this.loading = true;
					this.writeHashRoute();
					this.fetchPage().then(() => {
						this.loading = false;
					});
				}

			},

			/**
			 * Fetch current page data and update hash.
			 */
			fetchPageAndWriteHashRoute() {
				this.writeHashRoute();
				this.fetchPage();
			},

			/**
			 * Fetch current page data.
			 */
			fetchPage() {
				if (!this.page || !this.page.fetchData) {
					return new Promise.reject();
				} else {
					return this.page.fetchData(this.dataSearch, this.dataOffset, this.dataLimit)
						.then(result => {
							this.data = result;
						})
						.catch(error => {
							console.error(error); // eslint-disable-line no-console
							this.error = error;
							this.data = {};
						});
				}
			},

		},
	});
});