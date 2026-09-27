const form = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskCategory = document.getElementById('taskCategory');
const taskPriority = document.getElementById('taskPriority');
const taskRepeat = document.getElementById('taskRepeat');
const taskDate = document.getElementById('taskDate');
const taskTime = document.getElementById('taskTime');
const enableNotification = document.getElementById('enableNotification');
const taskList = document.getElementById('taskList');
const searchInput = document.getElementById('searchInput');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let currentPriorityFilter = 'all';

const soundFrequencies = {
  bell: [800, 600],
  alarm: [1000, 800, 1000],
  chime: [523.25, 659.25, 783.99],
  notification: [740, 880],
  alert: [1200, 900, 1200],
  gentle: [440, 550]
};

function playCustomSound(soundType) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const frequencies = soundFrequencies[soundType] || soundFrequencies.bell;
    
    let delay = 0;
    frequencies.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      osc.frequency.value = freq;
      osc.type = 'sine';
      
      const duration = soundType === 'chime' ? 0.2 : soundType === 'gentle' ? 0.3 : 0.15;
      const startTime = audioContext.currentTime + delay;
      
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
      
      delay += duration + 0.05;
    });
  } catch(e) {
    console.log('Sound not available');
  }
}

function previewSound() {
  const selectedSound = document.getElementById('notificationSound').value;
  playCustomSound(selectedSound);
}

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
  checkReminders();
}

function getNextDate(date, repeat) {
  const d = new Date(date);
  switch(repeat) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

function renderTasks() {
  const searchTerm = searchInput.value.toLowerCase();
  
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm);
    const matchesPriority = currentPriorityFilter === 'all' || task.priority === currentPriorityFilter;
    return matchesSearch && matchesPriority;
  });

  if (filteredTasks.length === 0) {
    taskList.innerHTML = '<div class="empty-state"><p>No tasks found.</p></div>';
    return;
  }

  taskList.innerHTML = '';
  
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    const dateA = new Date(a.date + ' ' + a.time);
    const dateB = new Date(b.date + ' ' + b.time);
    return dateA - dateB;
  });

  sortedTasks.forEach((task) => {
    const taskEl = document.createElement('div');
    taskEl.className = `task-item priority-${task.priority}` + (task.completed ? ' completed' : '');
    
    const taskDate = new Date(task.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let dateStr = '';
    if (taskDate.getTime() === today.getTime()) {
      dateStr = 'Today';
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (taskDate.getTime() === tomorrow.getTime()) {
        dateStr = 'Tomorrow';
      } else {
        dateStr = taskDate.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
      }
    }

    const priorityIcon = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
    const repeatText = task.repeat !== 'never' ? ` (${task.repeat})` : '';

    const realIndex = tasks.findIndex(t => t === task);

    taskEl.innerHTML = `
      <input 
        type="checkbox" 
        class="task-checkbox" 
        ${task.completed ? 'checked' : ''}
        onchange="toggleTask(${realIndex})"
      />
      <div class="task-content">
        <div class="task-title">${task.title}</div>
        <div class="task-meta">
          <span class="task-badge category">${task.category}</span>
          <span class="task-badge">${priorityIcon} ${task.priority}</span>
          <span class="task-time">📅 ${dateStr} at ${task.time}${repeatText}</span>
          <span class="task-time">🔊 ${task.sound}</span>
        </div>
      </div>
      <button class="task-btn" onclick="deleteTask(${realIndex})">✕</button>
    `;
    
    taskList.appendChild(taskEl);
  });
}

function toggleTask(index) {
  tasks[index].completed = !tasks[index].completed;
  saveTasks();
  renderTasks();
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasks();
  renderTasks();
}

function filterTasks() {
  renderTasks();
}

function filterByPriority(priority) {
  currentPriorityFilter = priority;
  
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderTasks();
}

function showNotification(task) {
  const selectedSound = task.sound || 'bell';
  playCustomSound(selectedSound);
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Task Reminder! 🔔', {
      body: `${task.title} (${task.category})`,
      tag: task.title,
      requireInteraction: true
    });
  }
}

function checkReminders() {
  const now = new Date();
  
  tasks.forEach(task => {
    if (task.completed) return;
    
    const taskDateTime = new Date(task.date + ' ' + task.time);
    const timeDiff = taskDateTime - now;
    
    if (timeDiff > 0 && timeDiff < 60000) {
      if (task.enableNotification !== false) {
        showNotification(task);
      }
      
      if (task.repeat !== 'never') {
        task.date = getNextDate(task.date, task.repeat);
        task.completed = false;
        saveTasks();
      }
    }
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  
  if (!taskTitle.value || !taskDate.value || !taskTime.value || !taskCategory.value) {
    alert('Please fill in all fields');
    return;
  }
  
  const selectedSound = document.getElementById('notificationSound').value;
  
  tasks.push({
    title: taskTitle.value,
    category: taskCategory.value,
    priority: taskPriority.value,
    repeat: taskRepeat.value,
    date: taskDate.value,
    time: taskTime.value,
    sound: selectedSound,
    enableNotification: enableNotification.checked,
    completed: false
  });
  
  saveTasks();
  renderTasks();
  
  taskTitle.value = '';
  taskCategory.value = '';
  taskPriority.value = 'low';
  taskRepeat.value = 'never';
  taskDate.value = '';
  taskTime.value = '';
  enableNotification.checked = true;
  document.getElementById('notificationSound').value = 'bell';
  taskTitle.focus();
});

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

renderTasks();
setInterval(checkReminders, 30000);
