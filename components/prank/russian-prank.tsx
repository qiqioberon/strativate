'use client'

import { useEffect } from 'react'

/**
 * TEMPORARY PRANK LAYER.
 *
 * This intentionally changes only rendered UI text in the browser. It does not
 * rewrite database content, URLs, form values, identifiers, or persisted data.
 * Reverting the commit that introduced this component restores the normal UI.
 */

const EXACT_TRANSLATIONS: Record<string, string> = {
  'home': 'Главная',
  'programs': 'Программы',
  'our programs': 'Наши программы',
  'digital products': 'Цифровые продукты',
  'mentors': 'Наставники',
  'meet our mentors': 'Познакомьтесь с нашими наставниками',
  'about us': 'О нас',
  'who we are': 'Кто мы',
  'faq': 'Частые вопросы',
  'publications & news': 'Публикации и новости',
  'discover top competitions': 'Лучшие соревнования',
  'chat on whatsapp': 'Написать в WhatsApp',
  'consultation': 'Консультация',
  'sign up': 'Регистрация',
  'log in': 'Войти',
  'login': 'Войти',
  'log out': 'Выйти',
  'logout': 'Выйти',
  'dashboard': 'Панель управления',
  'back to dashboard': 'Вернуться в панель',
  'profile': 'Профиль',
  'edit profile': 'Изменить профиль',
  'notifications': 'Уведомления',
  'calendar': 'Календарь',
  'orders': 'Заказы',
  'order history': 'История заказов',
  'payments': 'Платежи',
  'settings': 'Настройки',
  'save': 'Сохранить',
  'save changes': 'Сохранить изменения',
  'cancel': 'Отмена',
  'close': 'Закрыть',
  'open': 'Открыть',
  'edit': 'Редактировать',
  'delete': 'Удалить',
  'remove': 'Удалить',
  'add': 'Добавить',
  'create': 'Создать',
  'update': 'Обновить',
  'search': 'Поиск',
  'filter': 'Фильтр',
  'reset': 'Сбросить',
  'view': 'Просмотр',
  'details': 'Подробнее',
  'continue': 'Продолжить',
  'next': 'Далее',
  'previous': 'Назад',
  'back': 'Назад',
  'submit': 'Отправить',
  'confirm': 'Подтвердить',
  'loading': 'Загрузка',
  'loading...': 'Загрузка...',
  'loading…': 'Загрузка…',
  'try again': 'Попробовать снова',
  'success': 'Успешно',
  'error': 'Ошибка',
  'active': 'Активно',
  'inactive': 'Неактивно',
  'pending': 'Ожидание',
  'completed': 'Завершено',
  'cancelled': 'Отменено',
  'scheduled': 'Запланировано',
  'paid': 'Оплачено',
  'unpaid': 'Не оплачено',
  'draft': 'Черновик',
  'published': 'Опубликовано',
  'admin account': 'Аккаунт администратора',
  'mentor account': 'Аккаунт наставника',
  'mentee account': 'Аккаунт ученика',
  'close navigation': 'Закрыть навигацию',
  'open navigation': 'Открыть навигацию',
  'close menu': 'Закрыть меню',
  'loading mentor availability': 'Загрузка доступности наставника',
  'loading available slots…': 'Загрузка доступных слотов…',
  'no results': 'Нет результатов',
  'no data': 'Нет данных',
  'no notifications': 'Нет уведомлений',
  'view all programs': 'Посмотреть все программы',
  'learn more': 'Подробнее',
  'see details': 'Посмотреть детали',
  'contact us': 'Связаться с нами',
  'get started': 'Начать',
  'add to cart': 'Добавить в корзину',
  'cart': 'Корзина',
  'checkout': 'Оформление заказа',
  'my library': 'Моя библиотека',
  'my sessions': 'Мои сессии',
  'availability': 'Доступность',
  'session': 'Сессия',
  'sessions': 'Сессии',
  'schedule': 'Расписание',
  'mentor': 'Наставник',
  'mentee': 'Ученик',
  'competition': 'Соревнование',
  'competitions': 'Соревнования',
  'featured stories': 'Избранные истории',
  'learn from competition champions and industry professionals who have been where you want to go.':
    'Учитесь у чемпионов соревнований и профессионалов индустрии, которые уже прошли путь к вашей цели.',
  'win business competitions with expert mentoring':
    'Побеждайте в бизнес-соревнованиях с экспертным наставничеством',
  'transform your ideas into winning strategies. get personalized guidance from experienced mentors and achieve podium finishes.':
    'Превратите идеи в победные стратегии. Получайте персональные рекомендации опытных наставников и добивайтесь призовых мест.',
  'our mentors and students are award-winning business competition finalists.':
    'Наши наставники и ученики — отмеченные наградами финалисты бизнес-соревнований.',
  'where future-ready skills meet competition success':
    'Где навыки будущего встречаются с успехом в соревнованиях',
}

const WORD_TRANSLATIONS: Record<string, string> = {
  a: 'один',
  about: 'о',
  account: 'аккаунт',
  action: 'действие',
  actions: 'действия',
  add: 'добавить',
  address: 'адрес',
  admin: 'администратор',
  all: 'все',
  amount: 'сумма',
  and: 'и',
  answer: 'ответ',
  answers: 'ответы',
  application: 'заявка',
  approve: 'одобрить',
  approved: 'одобрено',
  are: 'являются',
  assign: 'назначить',
  assigned: 'назначено',
  available: 'доступно',
  availability: 'доступность',
  back: 'назад',
  bio: 'биография',
  business: 'бизнес',
  buy: 'купить',
  by: 'от',
  calendar: 'календарь',
  cancel: 'отмена',
  cancelled: 'отменено',
  card: 'карточка',
  cart: 'корзина',
  category: 'категория',
  change: 'изменить',
  changes: 'изменения',
  champion: 'чемпион',
  champions: 'чемпионы',
  chat: 'написать',
  checkout: 'оформление',
  choose: 'выбрать',
  close: 'закрыть',
  code: 'код',
  competition: 'соревнование',
  competitions: 'соревнования',
  complete: 'завершить',
  completed: 'завершено',
  confirm: 'подтвердить',
  consultation: 'консультация',
  contact: 'контакт',
  continue: 'продолжить',
  create: 'создать',
  current: 'текущий',
  dashboard: 'панель',
  date: 'дата',
  delete: 'удалить',
  description: 'описание',
  detail: 'деталь',
  details: 'подробности',
  digital: 'цифровые',
  discount: 'скидка',
  edit: 'редактировать',
  email: 'электронная почта',
  end: 'конец',
  error: 'ошибка',
  expertise: 'экспертиза',
  expert: 'эксперт',
  experts: 'эксперты',
  failed: 'не удалось',
  faq: 'вопросы',
  featured: 'избранные',
  filter: 'фильтр',
  final: 'финальный',
  finish: 'завершить',
  first: 'первый',
  for: 'для',
  from: 'из',
  get: 'получить',
  goal: 'цель',
  guide: 'руководство',
  help: 'помощь',
  history: 'история',
  home: 'главная',
  in: 'в',
  inactive: 'неактивно',
  industry: 'индустрия',
  information: 'информация',
  item: 'элемент',
  items: 'элементы',
  learn: 'учиться',
  library: 'библиотека',
  link: 'ссылка',
  list: 'список',
  loading: 'загрузка',
  login: 'войти',
  logout: 'выйти',
  management: 'управление',
  mentor: 'наставник',
  mentoring: 'наставничество',
  mentors: 'наставники',
  mentee: 'ученик',
  mentees: 'ученики',
  message: 'сообщение',
  name: 'имя',
  navigation: 'навигация',
  new: 'новый',
  news: 'новости',
  next: 'далее',
  no: 'нет',
  notification: 'уведомление',
  notifications: 'уведомления',
  of: 'из',
  on: 'на',
  open: 'открыть',
  order: 'заказ',
  orders: 'заказы',
  our: 'наши',
  paid: 'оплачено',
  participant: 'участник',
  participants: 'участники',
  password: 'пароль',
  payment: 'платёж',
  payments: 'платежи',
  pending: 'ожидание',
  previous: 'назад',
  price: 'цена',
  private: 'индивидуальное',
  product: 'продукт',
  products: 'продукты',
  profile: 'профиль',
  program: 'программа',
  programs: 'программы',
  publish: 'опубликовать',
  published: 'опубликовано',
  remove: 'удалить',
  result: 'результат',
  results: 'результаты',
  retry: 'повторить',
  role: 'роль',
  save: 'сохранить',
  schedule: 'расписание',
  scheduled: 'запланировано',
  search: 'поиск',
  select: 'выбрать',
  session: 'сессия',
  sessions: 'сессии',
  settings: 'настройки',
  sign: 'регистрация',
  slot: 'слот',
  slots: 'слоты',
  start: 'начать',
  status: 'статус',
  stories: 'истории',
  story: 'история',
  submit: 'отправить',
  success: 'успех',
  team: 'команда',
  teams: 'команды',
  time: 'время',
  title: 'заголовок',
  to: 'в',
  topic: 'тема',
  total: 'итого',
  transaction: 'транзакция',
  update: 'обновить',
  user: 'пользователь',
  users: 'пользователи',
  view: 'просмотр',
  with: 'с',
  you: 'вы',
  your: 'ваш',

  // Common Indonesian UI words.
  akun: 'аккаунт',
  aktif: 'активно',
  alamat: 'адрес',
  anda: 'вы',
  batal: 'отмена',
  belum: 'ещё не',
  buka: 'открыть',
  cari: 'поиск',
  daftar: 'список',
  dari: 'из',
  dengan: 'с',
  hapus: 'удалить',
  jadwal: 'расписание',
  kembali: 'назад',
  kosong: 'пусто',
  lanjut: 'продолжить',
  lihat: 'просмотр',
  nama: 'имя',
  pembayaran: 'платёж',
  pesanan: 'заказ',
  pilih: 'выбрать',
  profil: 'профиль',
  sesi: 'сессия',
  simpan: 'сохранить',
  tambah: 'добавить',
  tanggal: 'дата',
  tutup: 'закрыть',
  ubah: 'изменить',
  untuk: 'для',
}

const PROTECTED_WORDS = new Set([
  'strativate',
  'whatsapp',
  'google',
  'zoom',
  'midtrans',
  'supabase',
  'vercel',
  'linkedin',
  'instagram',
  'react',
  'next',
  'js',
  'api',
  'url',
  'id',
  'uuid',
  'rpc',
  'sql',
  'webp',
  'png',
  'jpg',
  'pdf',
  'rp',
])

const SKIP_SELECTOR = [
  'script',
  'style',
  'code',
  'pre',
  'kbd',
  'samp',
  'textarea',
  '[contenteditable="true"]',
  '[data-russian-prank-skip="true"]',
].join(',')

const TRANSLATED_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'] as const

function looksTechnical(value: string) {
  const text = value.trim()
  if (!text) return true
  if (/^(?:https?:\/\/|www\.)/i.test(text)) return true
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return true
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return true
  if (/^[\d\s.,:+\-/%()\[\]{}|]+$/.test(text)) return true
  if (/^[a-f0-9]{24,}$/i.test(text)) return true
  return false
}

function transliterateLatin(token: string) {
  const digraphs: Array<[RegExp, string]> = [
    [/sh/gi, 'ш'],
    [/ch/gi, 'ч'],
    [/zh/gi, 'ж'],
    [/kh/gi, 'х'],
    [/ts/gi, 'ц'],
    [/ya/gi, 'я'],
    [/yu/gi, 'ю'],
    [/yo/gi, 'ё'],
  ]

  let value = token
  for (const [pattern, replacement] of digraphs) value = value.replace(pattern, replacement)

  const map: Record<string, string> = {
    a: 'а', b: 'б', c: 'к', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х',
    i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п',
    q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс',
    y: 'й', z: 'з',
  }

  return value.replace(/[a-z]/gi, (letter) => map[letter.toLowerCase()] ?? letter)
}

function translateToken(token: string) {
  const lower = token.toLowerCase()

  if (PROTECTED_WORDS.has(lower)) return token
  if (WORD_TRANSLATIONS[lower]) return WORD_TRANSLATIONS[lower]

  // Preserve likely person/place/product names and acronyms.
  if (/^[A-Z][a-z]+(?:['’-][A-Za-z]+)?$/.test(token)) return token
  if (/^[A-Z0-9_-]{2,}$/.test(token)) return token

  return transliterateLatin(token)
}

function translateText(input: string) {
  if (!/[A-Za-z]/.test(input) || looksTechnical(input)) return input

  const leading = input.match(/^\s*/)?.[0] ?? ''
  const trailing = input.match(/\s*$/)?.[0] ?? ''
  const core = input.slice(leading.length, input.length - trailing.length)
  if (!core) return input

  const exact = EXACT_TRANSLATIONS[core.toLowerCase()]
  if (exact) return leading + exact + trailing

  const translated = core.replace(/[A-Za-z][A-Za-z'’-]*/g, translateToken)
  return leading + translated + trailing
}

function shouldSkip(node: Text | Element) {
  const element = node instanceof Text ? node.parentElement : node
  return Boolean(element?.closest(SKIP_SELECTOR))
}

function translateElementAttributes(element: Element) {
  if (shouldSkip(element)) return

  for (const attribute of TRANSLATED_ATTRIBUTES) {
    const value = element.getAttribute(attribute)
    if (!value) continue
    const translated = translateText(value)
    if (translated !== value) element.setAttribute(attribute, translated)
  }
}

function translateRoot(root: Node) {
  if (root instanceof Text) {
    if (shouldSkip(root)) return
    const value = root.nodeValue ?? ''
    const translated = translateText(value)
    if (translated !== value) root.nodeValue = translated
    return
  }

  if (root instanceof Element) translateElementAttributes(root)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    if (current instanceof Text) textNodes.push(current)
    current = walker.nextNode()
  }

  for (const node of textNodes) {
    if (shouldSkip(node)) continue
    const value = node.nodeValue ?? ''
    const translated = translateText(value)
    if (translated !== value) node.nodeValue = translated
  }

  if (root instanceof Element || root instanceof DocumentFragment || root instanceof Document) {
    const elements = root instanceof Element
      ? [root, ...Array.from(root.querySelectorAll('*'))]
      : Array.from(root.querySelectorAll('*'))
    elements.forEach(translateElementAttributes)
  }
}

export function RussianPrank() {
  useEffect(() => {
    document.documentElement.lang = 'ru'
    document.documentElement.dataset.prankLocale = 'ru'

    translateRoot(document.body)
    document.title = translateText(document.title)

    const pending = new Set<Node>()
    let frame: number | null = null

    const flush = () => {
      frame = null
      const roots = Array.from(pending)
      pending.clear()
      roots.forEach(translateRoot)
      document.title = translateText(document.title)
    }

    const schedule = (node: Node) => {
      pending.add(node)
      if (frame === null) frame = window.requestAnimationFrame(flush)
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          schedule(mutation.target)
          continue
        }
        if (mutation.type === 'attributes') {
          schedule(mutation.target)
          continue
        }
        mutation.addedNodes.forEach(schedule)
      }
    })

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATED_ATTRIBUTES],
    })

    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
