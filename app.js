(() => {
  const tg = window.Telegram?.WebApp;
  const initData = tg?.initData || '';
  let state = null;
  let selectedDevices = 0;
  let pendingPayment = null;
  let busy = false;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  if (tg) {
    tg.ready(); tg.expand(); tg.setHeaderColor('#070c15'); tg.setBackgroundColor('#070c15');
    if (tg.isVersionAtLeast?.('7.7')) tg.disableVerticalSwipes?.();
  }

  const haptic = (kind='light') => tg?.HapticFeedback?.impactOccurred(kind);
  const notify = (message) => { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(notify.timer); notify.timer=setTimeout(()=>el.classList.remove('show'),2600); };
  const fmtDate = (seconds) => seconds ? new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(seconds*1000)) : '—';
  const statusText = {active:'Активна',frozen:'Заморожена',expired:'Истекла',inactive:'Отключена',none:'Нет подписки'};
  const paymentText = {pending:'Ожидает оплаты',confirmed:'Подтверждён',processing:'Выдаём доступ',applied:'Оплачен',canceled:'Отменён',failed:'Нужна проверка',manual_review:'Ручная проверка'};
  const monthWord = (n) => n===1?'1 месяц':n<5?`${n} месяца`:`${n} месяцев`;
  const operationId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let barnumOffset = 0;
  const hashSeed = (id, bucket, salt = 0) => {
    let seed = (Number(id) || 1) ^ Math.imul(bucket + salt, 2654435761);
    seed = Math.imul(seed ^ (seed >>> 16), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    return (seed ^ (seed >>> 16)) >>> 0;
  };
  const personalMessage = (viewer) => {
    const name = viewer.first_name || 'Сегодня';
    const messages = [
      `${name}, самое время поверить в себя`,
      `${name}, ваша интуиция сегодня не подведёт`,
      `${name}, сегодня всё сложится как надо`,
      `${name}, вы ближе к цели, чем кажется`,
      `${name}, впереди кое-что очень хорошее`,
      `${name}, вы справляетесь лучше, чем думаете`,
      `${name}, ваш внутренний настрой решает многое`,
      `${name}, хороший поворот уже начался`,
      `${name}, доверьтесь своему первому ощущению`,
      `${name}, сегодня день спокойных побед`,
      `${name}, всё лишнее сегодня уйдёт само`,
      `${name}, правильный момент уже наступил`,
    ];
    const bucket = Math.floor(Date.now() / (12 * 60 * 60 * 1000));
    return messages[hashSeed(viewer.id, bucket, barnumOffset) % messages.length];
  };
  const barnumPrediction = (viewer) => {
    const predictions = [
      'Вы долго держали в голове одно решение, выжидая подходящий момент — сегодня обстоятельства сами подскажут простой и верный шаг.',
      'Снаружи вы кажетесь спокойнее, чем чувствуете себя внутри. Сбавьте к себе строгость: вы уже сделали больше, чем сами себе засчитываете.',
      'Мысль, к которой вы мысленно возвращаетесь последние дни, не случайна — ваше первое интуитивное ощущение оказалось самым точным.',
      'Вы привыкли рассчитывать только на себя, но сегодня неожиданная мелочь или вовремя сказанное слово приятно упростит вам задачу.',
      'Не пытайтесь сегодня контролировать каждую деталь: небольшая пауза сбережёт вам больше сил и приведёт к лучшему результату, чем спешка.',
      'У вас есть редкое свойство замечать нюансы, которые упускают другие — сегодня именно эта наблюдательность сыграет вам на руку.',
      'То, в чём вы недавно сомневались, скоро повернётся в вашу пользу. Вы выбрали верное направление, даже если сначала путь казался непростым.',
      'Иногда вы требуете от себя максимума там, где достаточно одного спокойного шага. Сегодня день, когда стоит выбрать собственный комфорт.',
      'Небольшая перемена в планах сегодня окажется к лучшему и откроет более лёгкий вариант, о котором вы сначала даже не думали.',
      'Внутри вас сейчас гораздо больше запаса прочности, чем кажется — стоит только начать, и нужное решение сложится само собой.',
      'Вопрос, который фоном забирал ваше внимание на этой неделе, решится проще и спокойнее, чем рисовало воображение.',
      'Вы часто ставите задачи других выше своих, но сегодня отличный повод сделать выбор в свою пользу — без лишних сомнений.',
      'Человек или хорошая новость, о которых вы недавно вспоминали, совсем скоро напомнят о себе с приятной стороны.',
      'Ваше умение сохранять холодную голову сегодня даст вам преимущество: пока остальные суетятся, вы спокойно заберёте лучший результат.',
      'Идея, которую вы отложили «на потом», снова актуальна — сейчас у вас уже достаточно опыта, чтобы реализовать её легко.',
      'Даже если день начался не совсем по расписанию, не торопитесь: эта небольшая пауза убережёт вас от лишней суеты.',
    ];
    const bucket = Math.floor(Date.now() / (12 * 60 * 60 * 1000));
    return predictions[hashSeed(viewer.id, bucket, 97 + barnumOffset) % predictions.length];
  };
  const nodeLabel = (nodeCode, inactive) => {
    const code = String(nodeCode || '').toLowerCase();
    if (code === 's4') return '🇫🇷 Париж · S4';
    if (code === 's3') return '🇦🇹 Вена · S3';
    if (code === 's2') return '🇪🇸 Испания · S2';
    if (code === 's1') return '🇵🇱 Польша · S1';
    if (code) return code.toUpperCase();
    return inactive ? 'ОЖИДАЕТ' : '—';
  };

  const API_BASES = window.location.hostname.endsWith('github.io')
    ? ['https://euloxe.com/nexus/api/', 'https://threats-january-partnership-famous.trycloudflare.com/nexus/api/']
    : ['/nexus/api/'];

  async function api(path, options={}) {
    const headers = {'X-Telegram-Init-Data':initData, ...(options.body?{'Content-Type':'application/json'}:{}), ...(options.headers||{})};
    let lastError = null;
    for (const base of API_BASES) {
      try {
        const response = await fetch(`${base}${path}`, {...options, headers});
        let data={}; try { data=await response.json(); } catch (_) {}
        if (!response.ok) throw new Error(data.message || data.error || 'Сервис временно недоступен');
        return data;
      } catch (err) {
        lastError = err;
        if (err instanceof TypeError && API_BASES.length > 1) continue;
        throw err;
      }
    }
    throw lastError || new Error('Сервис временно недоступен');
  }

  function go(view) {
    document.querySelectorAll('.view').forEach((el)=>el.classList.toggle('active',el.id===`${view}-view`));
    document.querySelectorAll('.bottom-nav button').forEach((el)=>el.classList.toggle('active',el.dataset.view===view));
    window.scrollTo({top:0,behavior:'smooth'}); haptic();
  }

  function openSheet(title, text, actions, field=false) {
    $('sheet-content').innerHTML=`<h2>${esc(title)}</h2><p>${esc(text)}</p>${field?'<label class="field"><span>Название устройства</span><input id="sheet-input" maxlength="30" autocomplete="off"></label>':''}<div class="sheet-actions">${actions.map((a)=>`<button class="${a.class||''}" data-sheet-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>`;
    actions.forEach((action)=>$('sheet-content').querySelector(`[data-sheet-action="${action.id}"]`).onclick=()=>action.run(field?$('sheet-input').value:'') );
    $('backdrop').classList.add('open'); $('sheet').classList.add('open');
    if(field) setTimeout(()=>$('sheet-input')?.focus(),320);
  }
  function closeSheet(){ $('backdrop').classList.remove('open'); $('sheet').classList.remove('open'); }

  async function runAction(path, body, options={}) {
    const {refresh=true, progress='Выполняем…', notifySuccess=true}=options;
    if (busy) return null;
    busy=true; closeSheet(); $('activity-text').textContent=progress; $('activity').hidden=false; tg?.MainButton?.showProgress?.();
    try { const result=await api(path,{method:'POST',body:JSON.stringify(body||{})}); if(notifySuccess)notify(result.message||'Готово'); tg?.HapticFeedback?.notificationOccurred?.('success'); if(refresh) await load(); return result; }
    catch(error){ notify(error.message); tg?.HapticFeedback?.notificationOccurred?.('error'); return null; }
    finally { busy=false; $('activity').hidden=true; tg?.MainButton?.hideProgress?.(); }
  }

  function showDeliveryResult(message){
    openSheet('Готово — проверьте чат',`${message} Чтобы сразу увидеть новые сообщения, закройте Mini App.`,[
      {id:'stay',label:'Остаться',run:closeSheet},
      {id:'chat',label:'Открыть чат',class:'primary',run:()=>tg?.close?.()},
    ]);
  }

  function renderHome() {
    const sub=state.subscription, viewer=state.viewer, familyMember=state.access_mode==='family_member';
    const inactive=state.cabinet_mode==='inactive';
    document.body.dataset.cabinetMode=state.cabinet_mode||'inactive';
    $('viewer-name').textContent=personalMessage(viewer);
    if ($('barnum-text')) $('barnum-text').textContent=barnumPrediction(viewer);
    const hour=new Date().getHours(); $('greeting').textContent=hour<6?'Доброй ночи':hour<12?'Доброе утро':hour<18?'Добрый день':'Добрый вечер';
    const pill=$('status-pill'); pill.textContent=statusText[sub.status]||sub.status; pill.className=`status-pill ${sub.status}`;
    $('days-value').textContent=sub.status==='frozen'?Math.ceil(sub.frozen_seconds/86400):sub.remaining_days;
    $('days-label').textContent=sub.status==='frozen'?'дней сохранено':sub.status==='none'?'оформите доступ':'дней осталось';
    $('subscription-kind').textContent=familyMember?'Семейный доступ':'Подписка';
    $('expiry-value').textContent=sub.status==='frozen'?'После разморозки':fmtDate(sub.expires_at);
    $('devices-value').textContent=familyMember?`${sub.occupied_slots} слот`:`${sub.occupied_slots} / ${sub.device_limit}`;
    $('protocol-value').textContent=sub.protocol==='amneziawg'?'AmneziaWG':sub.protocol==='hysteria'?'Hysteria':'—';
    $('card-node-value').textContent=nodeLabel(sub.server.node, inactive);
    $('freeze-caption').textContent=`доступно ${sub.freeze_bank_days} дн.`;
    const freeze=$('freeze-action'); freeze.hidden=familyMember||inactive; freeze.parentElement.classList.toggle('single',familyMember||inactive); freeze.dataset.action=sub.status==='frozen'?'unfreeze':'freeze'; freeze.querySelector('b').textContent=sub.status==='frozen'?'Разморозить подписку':'Заморозить подписку'; freeze.querySelector('.action-icon').innerHTML=icon(sub.status==='frozen'?'refresh':'snow');
    const purchase=$('purchase-cta');
    const lowDays=['active','frozen'].includes(sub.status)&&sub.remaining_days<=7;
    purchase.querySelector('b').textContent=familyMember?'Продлить всю семью':lowDays?'Продлить доступ заранее':['active','frozen'].includes(sub.status)?'Купить ещё время':'Подключить neXus Ray';
    purchase.querySelector('small').textContent=familyMember?'дни получат владелец и все участники':lowDays?'сохраните настройки без перерыва в работе':['active','frozen'].includes(sub.status)?'продлить срок с выгодой до 30% или изменить лимит':'мгновенная выдача ключей · основной и резервный контур';
    const badge=$('purchase-badge');
    if (badge) badge.textContent=familyMember?'Вся семья':lowDays?'Пора продлить':['active','frozen'].includes(sub.status)?'Выгода до −30%':'Мгновенно';
    const config=$('config-action'); config.hidden=inactive&&!familyMember; config.parentElement.hidden=inactive&&!familyMember; config.querySelector('b').textContent=familyMember?'Семейные настройки':sub.protocol==='amneziawg'?'Выбрать настройки':'Получить настройки'; config.querySelector('small').textContent=familyMember?'выберите свой семейный слот':sub.protocol==='amneziawg'?'по конкретному устройству':'ссылка придёт в чат с ботом';
    const regen=$('regen-action'); regen.hidden=inactive&&!familyMember; regen.querySelector('b').textContent=familyMember?'Перевыпустить семейный ключ':sub.protocol==='amneziawg'?'Перевыпустить устройство':'Перевыпустить доступ'; regen.querySelector('small').textContent=familyMember?'только ваш собственный слот':sub.protocol==='amneziawg'?'выберите конкретный слот':'старая ссылка перестанет работать';
    const management=regen.parentElement; management.hidden=inactive&&!familyMember; management.previousElementSibling.hidden=inactive&&!familyMember;
  }

  function deviceCard(slot, device) {
    if (!device) return `<article class="device-card empty"><div class="device-top"><div class="device-symbol">${icon('plus')}</div><div class="device-copy"><small>Слот ${slot}</small><b>Свободное место</b><span>Создайте отдельный ключ</span></div></div><button class="add-device" data-device="add" data-slot="${slot}">Добавить устройство</button></article>`;
    if(device.kind==='family_member'){const active=state.subscription.status==='active'&&device.configured;const unavailable=active?'':' disabled';const note=active?'Это только ваш ключ. Владелец семьи не может его скачать или перевыпустить.':state.subscription.status==='frozen'?'Владелец временно заморозил семейную подписку. Ваше место сохранено.':state.subscription.status==='active'?'Ключ временно восстанавливается. Попробуйте немного позже.':'Подписка владельца сейчас неактивна. Ваше место пока сохранено.';return `<article class="device-card family member"><div class="device-top"><div class="device-symbol">${icon('family')}</div><div class="device-copy"><small>Ваш семейный слот ${device.slot}</small><b>${esc(device.name)}</b><span>Владелец: ${esc(device.owner_name)}</span></div><i class="device-state${active?'':' waiting'}"></i></div><div class="device-note">${note}</div><div class="device-buttons"><button class="accent" data-device="family-get" data-slot="${device.slot}" data-owner="${device.owner_id}"${unavailable}>Получить файл</button><button data-device="family-rename" data-slot="${device.slot}" data-owner="${device.owner_id}"${unavailable}>Переименовать</button><button data-device="family-regenerate" data-slot="${device.slot}" data-owner="${device.owner_id}"${unavailable}>Перевыпустить</button><button class="danger" data-device="family-leave" data-slot="${device.slot}" data-owner="${device.owner_id}">Выйти из семьи</button></div></article>`;}
    if(device.kind==='family') return `<article class="device-card family"><div class="device-top"><div class="device-symbol">${icon('family')}</div><div class="device-copy"><small>Слот ${device.slot} · Семья</small><b>${esc(device.member_name||device.name)}</b><span>Отдельный ключ участника</span></div><i class="device-state"></i></div><div class="device-note">Файл и перевыпуск доступны только самому участнику.</div><button class="family-danger" data-device="revoke-family" data-slot="${device.slot}">Отозвать доступ</button></article>`;
    if(device.kind==='family_pending') return `<article class="device-card family pending"><div class="device-top"><div class="device-symbol">${icon('clock')}</div><div class="device-copy"><small>Слот ${device.slot} · Семья</small><b>Приглашение отправлено</b><span>Ожидает принятия участником</span></div><i class="device-state waiting"></i></div><button class="family-danger" data-device="cancel-invite" data-slot="${device.slot}">Отменить приглашение</button></article>`;
    return `<article class="device-card"><div class="device-top"><div class="device-symbol">${icon('phone')}</div><div class="device-copy"><small>Слот ${device.slot}</small><b>${esc(device.name)}</b><span>Конфигурация готова</span></div><i class="device-state"></i></div><div class="device-buttons"><button class="accent" data-device="get" data-slot="${device.slot}">Получить файл</button><button data-device="rename" data-slot="${device.slot}">Переименовать</button><button data-device="regenerate" data-slot="${device.slot}">Перевыпустить</button><button class="danger" data-device="delete" data-slot="${device.slot}" ${device.slot===1?'disabled':''}>Удалить</button></div></article>`;
  }
  function renderDevices() {
    const sub=state.subscription, list=$('device-list');
    if(state.access_mode==='family_member'){$('device-summary').textContent=`Семейный доступ · ${state.family_access.owner_name}`;list.innerHTML=state.devices.map((device)=>deviceCard(device.slot,device)).join('');return;}
    const familyCount=(state.family.members||0)+(state.family.pending||0); $('device-summary').textContent=`Занято ${sub.occupied_slots} из ${sub.device_limit}${familyCount?` · семейных мест ${familyCount}`:''}`;
    if(sub.protocol!=='amneziawg') { list.innerHTML=`<article class="device-card"><div class="device-top"><div class="device-symbol">${icon('server')}</div><div class="device-copy"><small>Единая подписка</small><b>Hysteria</b><span>До ${sub.device_limit} устройств</span></div><i class="device-state"></i></div><div class="device-buttons"><button class="accent" data-global-config>Получить ссылку</button><button data-global-regen>Перевыпустить</button></div></article>`; return; }
    const map=new Map(state.devices.map((d)=>[d.slot,d])); list.innerHTML=Array.from({length:sub.device_limit},(_,i)=>deviceCard(i+1,map.get(i+1))).join('');
  }

  function renderPlans() {
    const current=state.subscription.device_limit||1;
    const familyMember=state.access_mode==='family_member';
    const familyLimit=state.family_access?.plan_limit||7;
    if(familyMember) selectedDevices=familyLimit;
    else if(![1,3,7].includes(selectedDevices)) selectedDevices=current;
    $('device-selector').classList.toggle('single',familyMember);
    $('device-selector').innerHTML=familyMember?`<button class="active" disabled>${familyLimit} устройств · вся семья</button>`:[1,3,7].map((n)=>`<button data-limit="${n}" class="${n===selectedDevices?'active':''}">${n===current?`${n} · сейчас`:`${n} устр.`}</button>`).join('');
    const active=!familyMember&&['active','frozen'].includes(state.subscription.status), changing=active&&selectedDevices!==current, context=$('plan-context');
    const selectedOption=state.plan_change?.[String(selectedDevices)]||{allowed:true,reason:''};
    if(changing){
      const option=selectedOption;
      const frozen=state.subscription.status==='frozen';
      const oldPrice=state.plans.find((p)=>p.months===1).prices.find((p)=>p.devices===current).amount;
      const newPrice=state.plans.find((p)=>p.months===1).prices.find((p)=>p.devices===selectedDevices).amount;
      const seconds=frozen?state.subscription.frozen_seconds:Math.max(0,state.subscription.expires_at-Date.now()/1000);
      const newDays=Math.max(1,Math.ceil(seconds*oldPrice/newPrice/86400));
      const blocked=frozen?'Сначала разморозьте подписку.':option.reason;
      context.hidden=false; context.className=`plan-context${blocked?' blocked':''}`;
      context.innerHTML=`<small>Изменение текущего тарифа</small><h2>${current} → ${selectedDevices} устройств</h2><p>Это не покупка: деньги не списываются. Остаток времени будет пересчитан по стоимости тарифа — примерно <b>${newDays} дн.</b></p>${blocked?`<div class="plan-warning">${esc(blocked)}</div>`:'<div class="plan-safe">Ни один ключ не будет удалён автоматически.</div>'}<button data-change-plan ${blocked?'disabled':''}>Изменить лимит</button>`;
      $('plans-caption').textContent='Смена лимита отделена от покупки времени.';
      $('plan-list').innerHTML='';
      return;
    }
    if(!selectedOption.allowed&&!changing){
      context.hidden=false; context.className='plan-context blocked';
      context.innerHTML=`<small>Тариф недоступен</small><h2>${selectedDevices} устройств</h2><p>Семейные места принадлежат другим пользователям и не могут исчезнуть при покупке.</p><div class="plan-warning">${esc(selectedOption.reason)}</div>`;
      $('plans-caption').textContent='Сначала освободите семейные места.';
      $('plan-list').innerHTML='';
      return;
    }
    if(familyMember){
      context.hidden=false; context.className='plan-context family-switch';
      context.innerHTML=`<small>Общая семейная подписка</small><h2>Оплата для всей семьи</h2><p>Дни будут начислены подписке владельца <b>${esc(state.family_access.owner_name)}</b> и автоматически продлят доступ всех участников.</p><div class="plan-safe">Если позже выйти из семьи, уже оплаченные дни останутся у семейной подписки. Личный тариф покупается только после выхода.</div>`;
      $('plans-caption').textContent='Выберите срок продления общей подписки.';
    }else{
      context.hidden=true;
      $('plans-caption').textContent=active?'Покупка добавит время к текущему тарифу.':'Выберите количество устройств и период.';
    }
    const discounts={1:'Базовый период',3:'Выгода около 8%',6:'Выгода около 17%',12:'Максимальная выгода'};
    $('plan-list').innerHTML=state.plans.map((plan)=>{const item=plan.prices.find((p)=>p.devices===selectedDevices);const featured=plan.months===12;return `<article class="plan-card ${featured?'featured':''}"><div><small>${esc(discounts[plan.months])}</small><strong>${monthWord(plan.months)}</strong><span>${selectedDevices} устр. · ${item.amount} ₽</span></div><button data-buy="${plan.months}" ${!state.payments_enabled?'disabled':''}>Купить</button></article>`}).join('');
  }

  function renderMore() {
    const familyMember=state.access_mode==='family_member';
    $('profile-id').textContent=`Telegram ID ${state.viewer.id}`; $('metric-one-label').textContent=familyMember?'Тип доступа':'Заморозка'; $('metric-one-icon').innerHTML=icon(familyMember?'family':'snow'); $('freeze-bank').textContent=familyMember?'Семья':`${state.subscription.freeze_bank_days} дн.`; $('referral-count').textContent=state.referral?.invited??0; $('family-count').textContent=familyMember?state.family_access.owner_name:state.family.members?`${state.family.members} чел.`:'Нет';
    const rows=state.payment_history||[]; $('payment-history').innerHTML=rows.length?rows.map((p)=>{const family=p.purpose==='family_topup';const source=family&&p.payer_id!==state.viewer.id?' · оплатил участник':'';return `<article class="history-row"><span class="history-icon">₽</span><div><b>${family?'Вся семья':monthWord(p.months)} · ${p.devices} устр.</b><small>${fmtDate(p.applied_at||p.created_at)} · ${esc(paymentText[p.status]||p.status)}${source}</small></div><strong>${p.amount} ₽</strong></article>`}).join(''):'<div class="empty-history">Платежей пока нет</div>';
  }

  function render(){renderHome();renderDevices();renderPlans();renderMore();bindDynamic();}
  function bindDynamic(){
    document.querySelectorAll('[data-limit]').forEach((b)=>b.onclick=()=>{selectedDevices=Number(b.dataset.limit);renderPlans();bindDynamic();haptic();});
    document.querySelectorAll('[data-buy]').forEach((b)=>b.onclick=()=>startPurchase(Number(b.dataset.buy)));
    const changePlan=document.querySelector('[data-change-plan]'); if(changePlan)changePlan.onclick=confirmPlanChange;
    document.querySelectorAll('[data-device]').forEach((b)=>b.onclick=()=>devicePrompt(b.dataset.device,Number(b.dataset.slot),Number(b.dataset.owner||0)));
    const globalConfig=document.querySelector('[data-global-config]'); if(globalConfig)globalConfig.onclick=sendGlobalConfig;
    const globalRegen=document.querySelector('[data-global-regen]'); if(globalRegen)globalRegen.onclick=confirmRegenerate;
  }

  async function startPurchase(months){
    const current=state.subscription.device_limit, familyMember=state.access_mode==='family_member', active=!familyMember&&['active','frozen'].includes(state.subscription.status);
    if(active&&selectedDevices!==current){notify('Сначала примените изменение лимита.');return;}
    const price=state.plans.find((p)=>p.months===months).prices.find((p)=>p.devices===selectedDevices).amount;
    const familyWarning=familyMember?` Платёж продлит общую подписку владельца ${state.family_access.owner_name}; дни получат все участники и останутся у семьи даже после вашего выхода.`:'';
    openSheet(familyMember?'Продлить всю семью':'Купить подписку',`${monthWord(months)}, до ${selectedDevices} устройств. Сумма до учёта персональной скидки: ${price} ₽.${familyWarning}`,[{id:'cancel',label:'Отмена',run:closeSheet},{id:'pay',label:'Перейти к оплате',class:'primary',run:async()=>{const r=await runAction('payments',{months,devices:selectedDevices},{refresh:false,progress:'Создаём безопасный счёт…'});if(r){pendingPayment=r;$('pending-payment').hidden=false;$('pending-amount').textContent=`${r.amount} ₽`;tg?.openLink(r.confirmation_url);}}}]);
  }
  function confirmPlanChange(){const current=state.subscription.device_limit;openSheet('Изменить лимит?',`Текущий тариф: ${current} устройств. Новый тариф: ${selectedDevices}. Это не покупка — деньги не списываются, изменится остаток дней.`,[{id:'cancel',label:'Отмена',run:closeSheet},{id:'go',label:'Изменить лимит',class:'primary',run:()=>runAction('plan',{devices:selectedDevices,operation_id:operationId(),state_version:state.state_version},{progress:'Меняем лимит…'})}]);}
  function confirmRegenerate(){if(state.subscription.protocol==='amneziawg'){go('devices');notify('Выберите устройство для перевыпуска.');return;}openSheet('Перевыпустить доступ?', 'Старая ссылка сразу перестанет работать. Новую бот отправит в Telegram.',[{id:'cancel',label:'Отмена',run:closeSheet},{id:'go',label:'Перевыпустить',class:'danger',run:async()=>{const r=await runAction('regenerate',{operation_id:operationId(),state_version:state.state_version},{progress:'Безопасно перевыпускаем доступ…',notifySuccess:false});if(r)showDeliveryResult(r.message);}}]);}
  function devicePrompt(action,slot,ownerId=0){
    if(['add','rename','family-rename'].includes(action)){const familyRename=action==='family-rename';openSheet(action==='add'?'Новое устройство':'Переименовать устройство','Укажите короткое понятное название — например, «iPhone» или «Ноутбук».',[{id:'cancel',label:'Отмена',run:closeSheet},{id:'go',label:action==='add'?'Создать':'Сохранить',class:'primary',run:async(name)=>{const createsConfig=action==='add';const r=await runAction('devices',{action,slot,name,owner_id:ownerId||undefined},{progress:createsConfig?'Создаём и отправляем настройки…':'Сохраняем название…',notifySuccess:!createsConfig});if(r&&createsConfig)showDeliveryResult(r.message);}}],true);return;}
    const device=state.devices.find((item)=>item.slot===slot);
    const labels={get:['Получить настройки',`Файл и QR-код для «${device?.name||`Слот ${slot}`}» придут в чат с ботом.`,'Получить'],regenerate:['Перевыпустить ключ?',`Старый ключ устройства «${device?.name||`Слот ${slot}`}» перестанет работать.`,'Перевыпустить'],delete:['Удалить устройство?',`Ключ «${device?.name||`Слот ${slot}`}» перестанет работать на основном и резервном сервере.`,'Удалить'],['revoke-family']:['Отозвать семейный доступ?',`Участник «${device?.member_name||device?.name||`Слот ${slot}`}» потеряет доступ на основном и резервном сервере.`,'Отозвать'],['cancel-invite']:['Отменить приглашение?','Ссылка перестанет действовать, а слот снова станет свободным.','Отменить приглашение'],['family-get']:['Получить семейные настройки',`Файл и QR-код для «${device?.name||`Слот ${slot}`}» придут в ваш чат с ботом.`,'Получить'],['family-regenerate']:['Перевыпустить семейный ключ?',`Только ваш ключ «${device?.name||`Слот ${slot}`}» перестанет работать. Доступ остальных участников не изменится.`,'Перевыпустить'],['family-leave']:['Выйти из семьи?','Ваш ключ сразу перестанет работать, а уже оплаченные вами семейные дни останутся у общей подписки. После выхода личный тариф нужно купить отдельно.','Выйти из семьи']};const [title,text,label]=labels[action];openSheet(title,text,[{id:'cancel',label:'Назад',run:closeSheet},{id:'go',label,class:['delete','regenerate','revoke-family','cancel-invite','family-regenerate','family-leave'].includes(action)?'danger':'primary',run:async()=>{const sendsConfig=['get','regenerate','family-get','family-regenerate'].includes(action);const rotating=['regenerate','family-regenerate'].includes(action);const r=await runAction('devices',{action,slot,owner_id:ownerId||undefined,operation_id:rotating?operationId():undefined,subject_id:action==='revoke-family'?device?.member_id:undefined,invite_version:action==='cancel-invite'?device?.invite_version:undefined,device_version:action==='delete'?device?.device_version:undefined},{progress:sendsConfig?'Готовим и отправляем настройки…':'Сохраняем изменения…',notifySuccess:!sendsConfig});if(r&&sendsConfig)showDeliveryResult(r.message);}}]);
  }

  async function sendGlobalConfig(){
    if(state.access_mode==='family_member'||state.subscription.protocol==='amneziawg'){go('devices');notify(state.access_mode==='family_member'?'Откройте свой семейный слот.':'Выберите нужное устройство.');return;}
    const r=await runAction('configs',{}, {progress:'Отправляем настройки в Telegram…',notifySuccess:false});
    if(r)showDeliveryResult(r.message);
  }

  async function load(){
    try { state=await api('me'); selectedDevices=selectedDevices||(state.access_mode==='family_member'?(state.family_access?.plan_limit||7):state.subscription.device_limit); render(); $('loading').hidden=true;$('locked').hidden=true;$('content').hidden=false;$('nav').hidden=false; }
    catch(error){$('loading').hidden=true;$('content').hidden=true;$('nav').hidden=true;$('locked').hidden=false;}
  }

  document.querySelectorAll('[data-view]').forEach((b)=>b.onclick=()=>go(b.dataset.view));document.querySelectorAll('[data-go]').forEach((b)=>b.onclick=()=>go(b.dataset.go));
  document.querySelectorAll('[data-action]').forEach((b)=>b.onclick=()=>{const action=b.dataset.action;if(action==='configs')sendGlobalConfig();else if(action==='regenerate')confirmRegenerate();else if(action==='freeze'||action==='unfreeze')openSheet(action==='freeze'?'Заморозить подписку?':'Разморозить подписку?',action==='freeze'?'Дни перестанут расходоваться, а VPN временно отключится.':'VPN снова включится, а сохранённые дни продолжат расходоваться.',[{id:'cancel',label:'Отмена',run:closeSheet},{id:'go',label:action==='freeze'?'Заморозить':'Разморозить',class:'primary',run:()=>runAction(action,{},{progress:action==='freeze'?'Замораживаем подписку…':'Размораживаем подписку…'})}]);});
  const cycleBarnum = () => {
    if (!state?.viewer) return;
    barnumOffset += 1;
    haptic('light');
    $('viewer-name').textContent = personalMessage(state.viewer);
    if ($('barnum-text')) $('barnum-text').textContent = barnumPrediction(state.viewer);
  };
  if ($('barnum-card')) {
    $('barnum-card').onclick = cycleBarnum;
    $('barnum-card').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleBarnum(); } };
  }
  if ($('barnum-chip')) $('barnum-chip').onclick = cycleBarnum;
  $('refresh').onclick=()=>load();$('sheet-close').onclick=closeSheet;$('backdrop').onclick=closeSheet;
  $('support-link').onclick=()=>{if(tg?.openTelegramLink)tg.openTelegramLink(state.support_url);else window.open(state.support_url,'_blank');};$('offer-link').onclick=()=>{const url='https://telegra.ph/Publichnaya-oferta-Polzovatelskoe-soglashenie-02-22';if(tg?.openLink)tg.openLink(url);else window.open(url,'_blank');};
  $('check-payment').onclick=async()=>{if(!pendingPayment)return;const r=await runAction('payments/check',{payment_id:pendingPayment.payment_id},{progress:'Проверяем оплату…'});if(['applied','confirmed','manual_review'].includes(r?.status))$('pending-payment').hidden=true;};
  if(!initData){setTimeout(()=>{$('loading').hidden=true;$('locked').hidden=false;},500);}else load();
})();

