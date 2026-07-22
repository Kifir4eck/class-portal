import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js';
import {
  collection, addDoc, getDocs, query, where, limit,
  updateDoc, deleteDoc, doc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js';

// ---- Элементы DOM ----
const authContainer = document.getElementById('authContainer');
const appContent = document.getElementById('appContent');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const showAddBtn = document.getElementById('showAddAchievementBtn');
const addForm = document.getElementById('addAchievementForm');
const submitAchBtn = document.getElementById('submitAchievementBtn');
const cancelAddBtn = document.getElementById('cancelAddAchievementBtn');
const newAchievementCard = document.getElementById('newAchievementCard');
const pageContainer = document.getElementById('pageContainer');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.querySelector('.modal-close');
const showProfileLink = document.getElementById('showProfileLink');
const showStudentsLink = document.getElementById('showStudentsLink');
const showTopLink = document.getElementById('showTopLink');
const showStatisticsLink = document.getElementById('showStatisticsLink');

let currentUser = null;
let currentUserDoc = null;
let currentViewType = null;
let currentViewUid = null;
let userLikesSet = new Set();

// ---- Закрытие модалки ----
function closeModal() {
  modal.style.display = 'none';
  loadNewAchievement();
  refreshCurrentView();
}

function refreshCurrentView() {
  if (currentViewType === 'profile' && currentViewUid) {
    showUserProfile(currentViewUid);
  } else if (currentViewType === 'top') {
    showTopAchievements();
  }
}

// ---- Загрузка лайков ----
async function loadUserLikes() {
  if (!currentUser) return;
  try {
    const q = query(collection(db, 'likes'), where('userId', '==', currentUser.uid));
    const snap = await getDocs(q);
    userLikesSet = new Set(snap.docs.map(d => d.data().achievementId));
  } catch (e) {
    console.error('Ошибка загрузки лайков:', e);
    userLikesSet = new Set();
  }
}

// ---- Авторизация ----
showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert('Ошибка входа: ' + e.message);
  }
});

registerBtn.addEventListener('click', async () => {
  const firstName = document.getElementById('regFirstName').value.trim();
  const lastName = document.getElementById('regLastName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const className = document.getElementById('regClass').value.trim();
  const age = document.getElementById('regAge').value.trim();

  if (!firstName || !lastName || !email || !password || !className) {
    alert('Заполните все обязательные поля (Имя, Фамилия, Email, Пароль, Класс)');
    return;
  }

  const fullName = `${firstName} ${lastName}`;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const userData = {
      uid: userCred.user.uid,
      firstName,
      lastName,
      fullName,
      email,
      class: className,
      role: 'student',
      createdAt: serverTimestamp()
    };
    if (age && !isNaN(age) && age > 0) {
      userData.age = parseInt(age);
    }
    await addDoc(collection(db, 'users'), userData);
    alert('Регистрация успешна!');
  } catch (e) {
    alert('Ошибка регистрации: ' + e.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
});

// ---- Отслеживание состояния входа ----
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    authContainer.style.display = 'none';
    appContent.style.display = 'block';
    const q = query(collection(db, 'users'), where('uid', '==', user.uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      currentUserDoc = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }
    await loadUserLikes();
    loadNewAchievement();
  } else {
    currentUser = null;
    currentUserDoc = null;
    userLikesSet = new Set();
    authContainer.style.display = 'block';
    appContent.style.display = 'none';
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }
});

// ---- Добавление достижения ----
showAddBtn.addEventListener('click', () => {
  addForm.style.display = 'block';
});

cancelAddBtn.addEventListener('click', () => {
  addForm.style.display = 'none';
});

submitAchBtn.addEventListener('click', async () => {
  const title = document.getElementById('achTitle').value;
  const category = document.getElementById('achCategory').value;
  const description = document.getElementById('achDescription').value;
  if (!title || !description) {
    alert('Заполните название и описание');
    return;
  }
  try {
    await addDoc(collection(db, 'achievements'), {
      userId: currentUser.uid,
      title,
      category,
      description,
      likesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDeleted: false
    });
    alert('Достижение добавлено!');
    addForm.style.display = 'none';
    document.getElementById('achTitle').value = '';
    document.getElementById('achDescription').value = '';
    loadNewAchievement();
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
});

// ---- Загрузка ленты новых достижений ----
async function loadNewAchievement() {
  if (!currentUser) return;
  try {
    const qAchievements = query(
      collection(db, 'achievements'),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(qAchievements);
    let achievements = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    achievements = achievements.filter(a => {
      if (!a.createdAt) return false;
      const date = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000);
      return date >= weekAgo;
    });

    achievements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const qViews = query(collection(db, 'views'), where('userId', '==', currentUser.uid));
    const viewsSnap = await getDocs(qViews);
    const viewedIds = viewsSnap.docs.map(d => d.data().achievementId);

    const newAchievements = achievements.filter(a => !viewedIds.includes(a.id));

    if (newAchievements.length === 0) {
      newAchievementCard.innerHTML = `<div class="feed__card-placeholder">Новых достижений за неделю нет</div>`;
      newAchievementCard.onclick = null;
      return;
    }

    const latest = newAchievements[0];
    let authorName = 'Неизвестно';
    let authorClass = '';
    try {
      const userQuery = query(collection(db, 'users'), where('uid', '==', latest.userId));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        authorName = userData.fullName || userData.firstName || 'Неизвестно';
        authorClass = userData.class ? ` (${userData.class})` : '';
      }
    } catch (e) {
      console.error('Ошибка получения автора:', e);
    }

    newAchievementCard.innerHTML = `
      <div style="text-align:left; width:100%;">
        <h4>${latest.title}</h4>
        <p><strong>Категория:</strong> ${latest.category || 'без категории'}</p>
        <p><strong>Автор:</strong> ${authorName}${authorClass}</p>
        <small>${latest.createdAt ? new Date(latest.createdAt.seconds * 1000).toLocaleString() : ''}</small>
      </div>
    `;

    newAchievementCard.onclick = () => {
      showNewAchievementsModal(newAchievements);
    };

  } catch (e) {
    console.error(e);
    newAchievementCard.innerHTML = `<div class="feed__card-placeholder">Ошибка загрузки</div>`;
  }
}

// ---- Модальное окно с новыми достижениями ----
async function showNewAchievementsModal(achievements) {
  let currentIndex = 0;
  const total = achievements.length;

  const authorCache = {};

  async function getAuthorName(userId) {
    if (authorCache[userId]) return authorCache[userId];
    try {
      const userQuery = query(collection(db, 'users'), where('uid', '==', userId));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data();
        const name = userData.fullName || userData.firstName || 'Неизвестно';
        const cls = userData.class ? ` (${userData.class})` : '';
        authorCache[userId] = name + cls;
        return authorCache[userId];
      }
    } catch (e) {
      console.error('Ошибка получения автора:', e);
    }
    return 'Неизвестно';
  }

  async function renderCard(index) {
    if (index >= total) {
      modalBody.innerHTML = `<div style="text-align:center;"><p>Вы просмотрели все новые достижения за неделю</p><button id="closeModalBtn">Закрыть</button></div>`;
      document.getElementById('closeModalBtn')?.addEventListener('click', () => {
        closeModal();
        loadNewAchievement();
      });
      return;
    }
    const a = achievements[index];
    const dateStr = a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleString() : '';
    const author = await getAuthorName(a.userId);
    const liked = userLikesSet.has(a.id);
    const likeIcon = liked ? '❤️' : '♡';

    modalBody.innerHTML = `
      <div style="text-align:left;">
        <h3>${a.title}</h3>
        <p><strong>Категория:</strong> ${a.category || 'без категории'}</p>
        <p><strong>Автор:</strong> ${author}</p>
        <p><small>${dateStr}</small></p>
        <div style="margin-top:20px;">
          <button id="prevCardBtn" ${index === 0 ? 'disabled' : ''}>◀ Назад</button>
          <button id="nextCardBtn" ${index === total - 1 ? 'disabled' : ''}>Вперёд ▶</button>
          <button id="viewFullBtn">Подробнее</button>
        </div>
        <div style="margin-top:10px;">
          <button id="likeFromModal" class="like-btn">${likeIcon} ${a.likesCount || 0}</button>
        </div>
      </div>
    `;

    document.getElementById('prevCardBtn')?.addEventListener('click', async () => {
      if (currentIndex > 0) {
        currentIndex--;
        await renderCard(currentIndex);
        await markAsViewed(achievements[currentIndex].id);
      }
    });
    document.getElementById('nextCardBtn')?.addEventListener('click', async () => {
      if (currentIndex < total - 1) {
        currentIndex++;
        await renderCard(currentIndex);
        await markAsViewed(achievements[currentIndex].id);
      }
    });
    document.getElementById('viewFullBtn')?.addEventListener('click', () => {
      showFullAchievement(achievements[currentIndex].id);
    });
    document.getElementById('likeFromModal')?.addEventListener('click', async () => {
      await toggleLike(achievements[currentIndex].id);
      await renderCard(currentIndex);
    });

    await markAsViewed(a.id);
  }

  modal.style.display = 'block';
  await renderCard(0);
}

// ---- Отметка просмотра ----
async function markAsViewed(achievementId) {
  if (!currentUser) return;
  try {
    const q = query(
      collection(db, 'views'),
      where('userId', '==', currentUser.uid),
      where('achievementId', '==', achievementId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, 'views'), {
        userId: currentUser.uid,
        achievementId: achievementId,
        viewedAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.error('Ошибка отметки просмотра:', e);
  }
}

// ---- Полная информация о достижении ----
async function showFullAchievement(achievementId) {
  console.log('showFullAchievement вызвана с ID:', achievementId);
  try {
    const docSnap = await getDoc(doc(db, 'achievements', achievementId));
    if (!docSnap.exists()) {
      console.log('Документ не найден');
      alert('Достижение не найдено');
      return;
    }
    const a = docSnap.data();
    const userQuery = query(collection(db, 'users'), where('uid', '==', a.userId));
    const userSnap = await getDocs(userQuery);
    const authorName = userSnap.empty ? 'Неизвестно' : (userSnap.docs[0].data().fullName || userSnap.docs[0].data().firstName || 'Неизвестно');
    const isAuthor = currentUser && a.userId === currentUser.uid;
    const liked = userLikesSet.has(achievementId);
    const likeIcon = liked ? '❤️' : '♡';

    markAsViewed(achievementId);

    modalBody.innerHTML = `
      <div style="text-align:left;">
        <h2>${a.title}</h2>
        <p><strong>Автор:</strong> ${authorName}</p>
        <p><strong>Категория:</strong> ${a.category}</p>
        <p><strong>Дата:</strong> ${a.createdAt ? new Date(a.createdAt.seconds * 1000).toLocaleString() : ''}</p>
        <p><strong>Описание:</strong> ${a.description || ''}</p>
        <div style="margin-top:15px;">
          <button id="likeFullBtn" class="like-btn">${likeIcon} ${a.likesCount || 0}</button>
          ${isAuthor ? `<button id="deleteFullBtn" style="margin-left:10px;background:red;color:white;border:none;padding:5px 15px;border-radius:6px;cursor:pointer;">Удалить</button>` : ''}
        </div>
        <div style="margin-top:15px;">
          <button id="closeFullBtn">Закрыть</button>
        </div>
      </div>
    `;
    modal.style.display = 'block';

    document.getElementById('likeFullBtn')?.addEventListener('click', async () => {
      await toggleLike(achievementId);
      showFullAchievement(achievementId);
    });

    document.getElementById('deleteFullBtn')?.addEventListener('click', async () => {
      if (confirm('Вы уверены, что хотите удалить это достижение?')) {
        try {
          await updateDoc(doc(db, 'achievements', achievementId), {
            isDeleted: true
          });
          alert('Достижение удалено');
          closeModal();
          loadNewAchievement();
          refreshCurrentView();
        } catch (e) {
          alert('Ошибка удаления: ' + e.message);
        }
      }
    });

    document.getElementById('closeFullBtn')?.addEventListener('click', () => {
      closeModal();
    });
  } catch (e) {
    console.error('Ошибка в showFullAchievement:', e);
    alert('Ошибка загрузки: ' + e.message);
  }
}

// ---- Лайк ----
async function toggleLike(achievementId) {
  if (!currentUser) return;
  try {
    const achRef = doc(db, 'achievements', achievementId);
    const achSnap = await getDoc(achRef);
    if (!achSnap.exists()) return;
    const achievementData = achSnap.data();
    if (achievementData.userId === currentUser.uid) {
      alert('Нельзя ставить лайк на своё достижение');
      return;
    }

    const q = query(
      collection(db, 'likes'),
      where('userId', '==', currentUser.uid),
      where('achievementId', '==', achievementId)
    );
    const snap = await getDocs(q);
    const currentLikes = achievementData.likesCount || 0;

    if (snap.empty) {
      await addDoc(collection(db, 'likes'), {
        userId: currentUser.uid,
        achievementId: achievementId,
        createdAt: serverTimestamp()
      });
      await updateDoc(achRef, { likesCount: currentLikes + 1 });
      userLikesSet.add(achievementId);
    } else {
      await deleteDoc(doc(db, 'likes', snap.docs[0].id));
      await updateDoc(achRef, { likesCount: Math.max(0, currentLikes - 1) });
      userLikesSet.delete(achievementId);
    }
  } catch (e) {
    console.error('Ошибка лайка:', e);
  }
}

// ---- Список учеников ----
async function showStudents() {
  currentViewType = 'students';
  currentViewUid = null;
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const snap = await getDocs(q);
    let html = '<h2>Список учеников</h2>';
    snap.forEach(doc => {
      const u = doc.data();
      const displayName = u.fullName || u.firstName || 'Без имени';
      html += `<div class="user-card" data-uid="${u.uid}">${displayName} (${u.class})</div>`;
    });
    pageContainer.innerHTML = html;
  } catch (e) {
    pageContainer.innerHTML = 'Ошибка загрузки';
  }
}

// ---- Профиль ученика ----
async function showUserProfile(uid) {
  currentViewType = 'profile';
  currentViewUid = uid;
  try {
    const q = query(collection(db, 'users'), where('uid', '==', uid));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const userDoc = snap.docs[0];
    const user = userDoc.data();

    const displayName = user.fullName || user.firstName || 'Без имени';
    const ageText = user.age ? `${user.age} лет` : 'не указан';

    const qAch = query(
      collection(db, 'achievements'),
      where('userId', '==', uid),
      where('isDeleted', '==', false)
    );
    const achSnap = await getDocs(qAch);
    let achievements = achSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    achievements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    let html = `
      <h2>${displayName}</h2>
      ${user.avatarUrl ? `<img src="${user.avatarUrl}" style="max-width:150px;border-radius:50%;"/>` : ''}
      <p>Класс: ${user.class}</p>
      <p>Возраст: ${ageText}</p>
      <hr/>
      <h3>Достижения</h3>
      <div>
        <button id="sortDateBtn">По дате (новые)</button>
        <button id="sortLikesBtn">По популярности</button>
      </div>
      <div id="achievementsList">
        ${achievements.map(a => {
      const liked = userLikesSet.has(a.id);
      const likeIcon = liked ? '❤️' : '♡';
      return `
            <div class="achievement-item" data-id="${a.id}" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee;">
              <h4>${a.title}</h4>
              <p><strong>Категория:</strong> ${a.category || 'без категории'}</p>
              <small><span class="like-icon">${likeIcon}</span> ${a.likesCount || 0}</small>
            </div>
          `;
    }).join('')}
      </div>
    `;
    pageContainer.innerHTML = html;

    document.getElementById('sortDateBtn')?.addEventListener('click', () => {
      achievements.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderAchievementsList(achievements);
    });
    document.getElementById('sortLikesBtn')?.addEventListener('click', () => {
      achievements.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
      renderAchievementsList(achievements);
    });

  } catch (e) {
    pageContainer.innerHTML = 'Ошибка загрузки профиля';
    console.error(e);
  }
}

function renderAchievementsList(achievements) {
  const container = document.getElementById('achievementsList');
  if (!container) return;
  container.innerHTML = achievements.map(a => {
    const liked = userLikesSet.has(a.id);
    const likeIcon = liked ? '❤️' : '♡';
    return `
      <div class="achievement-item" data-id="${a.id}" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee;">
        <h4>${a.title}</h4>
        <p><strong>Категория:</strong> ${a.category || 'без категории'}</p>
        <small><span class="like-icon">${likeIcon}</span> ${a.likesCount || 0}</small>
      </div>
    `;
  }).join('');
}

// ---- Топ-10 достижений ----
async function showTopAchievements() {
  currentViewType = 'top';
  currentViewUid = null;
  try {
    const authorCache = {};
    async function getAuthorName(userId) {
      if (authorCache[userId]) return authorCache[userId];
      try {
        const userQuery = query(collection(db, 'users'), where('uid', '==', userId));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          const name = userData.fullName || userData.firstName || 'Неизвестно';
          const cls = userData.class ? ` (${userData.class})` : '';
          authorCache[userId] = name + cls;
          return authorCache[userId];
        }
      } catch (e) {
        console.error('Ошибка получения автора:', e);
      }
      return 'Неизвестно';
    }

    const q = query(
      collection(db, 'achievements'),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    let achievements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    achievements.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    const top10 = achievements.slice(0, 10);

    const topWithAuthors = await Promise.all(top10.map(async (a) => {
      const author = await getAuthorName(a.userId);
      const liked = userLikesSet.has(a.id);
      const likeIcon = liked ? '❤️' : '♡';
      return { ...a, author, likeIcon };
    }));

    let html = '<h2>Топ-10 достижений</h2>';
    html += '<div id="topList">';
    topWithAuthors.forEach(a => {
      html += `<div class="achievement-item" data-id="${a.id}" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee;">
        <h4>${a.title}</h4>
        <p><strong>Категория:</strong> ${a.category || 'без категории'}</p>
        <p><strong>Автор:</strong> ${a.author}</p>
        <small><span class="like-icon">${a.likeIcon}</span> ${a.likesCount || 0}</small>
      </div>`;
    });
    html += '</div>';
    pageContainer.innerHTML = html;
  } catch (e) {
    pageContainer.innerHTML = 'Ошибка загрузки топа';
  }
}

// ---- Статистика для учителя ----
async function showStatistics() {
  if (!currentUserDoc || currentUserDoc.role !== 'teacher') {
    pageContainer.innerHTML = '<p>Доступно только учителям.</p>';
    return;
  }
  pageContainer.innerHTML = `
    <h2>Статистика</h2>
    <div class="stat-block">
      <label>Класс: <input type="text" id="statClass" placeholder="7В" /></label>
      <label>Ученик (email): <input type="text" id="statUserEmail" placeholder="email" /></label>
      <label>Месяц: <input type="month" id="statMonth" /></label>
      <button id="getStatBtn">Показать</button>
    </div>
    <div id="statResult"></div>
  `;

  document.getElementById('getStatBtn').addEventListener('click', async () => {
    const className = document.getElementById('statClass').value;
    const userEmail = document.getElementById('statUserEmail').value;
    const month = document.getElementById('statMonth').value;
    if (!month) { alert('Выберите месяц'); return; }
    const [year, monthNum] = month.split('-');
    const start = new Date(year, monthNum - 1, 1);
    const end = new Date(year, monthNum, 0);

    try {
      const q = query(collection(db, 'achievements'), where('isDeleted', '==', false));
      const snap = await getDocs(q);
      let achievements = snap.docs.map(d => d.data());

      achievements = achievements.filter(a => {
        if (!a.createdAt) return false;
        const date = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt.seconds * 1000);
        return date >= start && date <= end;
      });

      if (className) {
        const usersSnap = await getDocs(query(collection(db, 'users'), where('class', '==', className)));
        const userIds = usersSnap.docs.map(d => d.data().uid);
        achievements = achievements.filter(a => userIds.includes(a.userId));
      }
      if (userEmail) {
        const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail)));
        if (!userSnap.empty) {
          const uid = userSnap.docs[0].data().uid;
          achievements = achievements.filter(a => a.userId === uid);
        } else {
          achievements = [];
        }
      }

      const count = achievements.length;
      document.getElementById('statResult').innerHTML = `
        <p>Количество достижений: <strong>${count}</strong></p>
        <p>${count > 0 ? 'Список достижений: ' + achievements.map(a => a.title).join(', ') : 'Нет достижений'}</p>
      `;
    } catch (e) {
      alert('Ошибка статистики: ' + e.message);
    }
  });
}

// ---- НАВИГАЦИЯ ----
showProfileLink.addEventListener('click', (e) => {
  e.preventDefault();
  if (currentUser) {
    showUserProfile(currentUser.uid);
  } else {
    alert('Вы не авторизованы');
  }
});

showStudentsLink.addEventListener('click', (e) => {
  e.preventDefault();
  showStudents();
});
showTopLink.addEventListener('click', (e) => {
  e.preventDefault();
  showTopAchievements();
});
showStatisticsLink.addEventListener('click', (e) => {
  e.preventDefault();
  showStatistics();
});

// ---- Закрытие модалки ----
modalClose.addEventListener('click', () => {
  closeModal();
});

window.addEventListener('click', (e) => {
  if (e.target === modal) {
    closeModal();
  }
});

// ---- Универсальный обработчик на pageContainer ----
pageContainer.addEventListener('click', (e) => {
  const userCard = e.target.closest('.user-card');
  if (userCard) {
    const uid = userCard.dataset.uid;
    if (uid) showUserProfile(uid);
    return;
  }

  const achievementItem = e.target.closest('.achievement-item');
  if (achievementItem) {
    if (e.target.tagName === 'A') {
      e.preventDefault();
    }
    const id = achievementItem.dataset.id;
    if (id) showFullAchievement(id);
  }
});

console.log('Портал "Достижения 7В" запущен');