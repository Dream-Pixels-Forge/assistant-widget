// Task Service for managing goals, tasks, and task delegation
const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

class TaskService {
  constructor() {
    // Get user data path, with fallback for testing
    let userDataPath;
    try {
      userDataPath = app.getPath('userData');
    } catch (e) {
      // Fallback to a temporary directory for testing
      const os = require('node:os');
      userDataPath = path.join(os.tmpdir(), 'assistant-test');
    }
    this.dataPath = path.join(userDataPath, 'tasks.json');
    this.tasks = this.loadTasks();
    this.nextId = this.getNextId();
    console.log('Task Service initialized');
  }

  loadTasks() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        return JSON.parse(data);
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      return [];
    }
  }

  saveTasks() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.tasks, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving tasks:', error);
      return false;
    }
  }

  getNextId() {
    if (this.tasks.length === 0) return 1;
    return Math.max(...this.tasks.map(t => t.id)) + 1;
  }

  // Goal decomposition: break down a goal into tasks
  async decomposeGoal(goal) {
    // In a real implementation, this would use an LLM to break down the goal
    // For now, we'll use a simple rule-based approach
    const lowerGoal = goal.toLowerCase();
    
    let tasks = [];
    
    // Simple keyword-based task decomposition
    if (lowerGoal.includes('write') || lowerGoal.includes('draft') || lowerGoal.includes('email')) {
      tasks = [
        { title: 'Outline the main points', completed: false },
        { title: 'Write the first draft', completed: false },
        { title: 'Review and edit for clarity', completed: false },
        { title: 'Check grammar and spelling', completed: false },
        { title: 'Finalize and send/save', completed: false }
      ];
    } else if (lowerGoal.includes('presentation') || lowerGoal.includes('talk') || lowerGoal.includes('speak')) {
      tasks = [
        { title: 'Define the objective and audience', completed: false },
        { title: 'Create an outline of the talk', completed: false },
        { title: 'Design slides or visual aids', completed: false },
        { title: 'Practice the delivery', completed: false },
        { title: 'Prepare for questions', completed: false },
        { title: 'Deliver the presentation', completed: false }
      ];
    } else if (lowerGoal.includes('project') || lowerGoal.includes('plan') || lowerGoal.includes('organize')) {
      tasks = [
        { title: 'Define the project scope and goals', completed: false },
        { title: 'Break down into major milestones', completed: false },
        { title: 'Create a timeline with deadlines', completed: false },
        { title: 'Identify required resources', completed: false },
        { title: 'Assign responsibilities', completed: false },
        { title: 'Set up tracking and review process', completed: false }
      ];
    } else {
      // Generic task breakdown
      tasks = [
        { title: 'Research and gather information', completed: false },
        { title: 'Create a plan of action', completed: false },
        { title: 'Execute the first step', completed: false },
        { title: 'Review progress and adjust', completed: false },
        { title: 'Complete and review the outcome', completed: false }
      ];
    }
    
    // Add IDs and timestamps
    const now = new Date().toISOString();
    return tasks.map((task, index) => ({
      id: this.nextId++,
      goal: goal,
      title: task.title,
      completed: task.completed,
      createdAt: now,
      updatedAt: now
    }));
  }

  // Add a task (or multiple tasks from goal decomposition)
  addTask(task) {
    const now = new Date().toISOString();
    const taskToAdd = {
      ...task,
      id: this.nextId++,
      createdAt: now,
      updatedAt: now
    };
    
    this.tasks.push(taskToAdd);
    this.saveTasks();
    return taskToAdd;
  }

  addTasksFromGoal(goal) {
    const tasks = this.decomposeGoal(goal);
    const addedTasks = [];
    for (const task of tasks) {
      addedTasks.push(this.addTask(task));
    }
    return addedTasks;
  }

  // Get all tasks
  getTasks(filter = {}) {
    let filteredTasks = [...this.tasks];
    
    if (filter.completed !== undefined) {
      filteredTasks = filteredTasks.filter(t => t.completed === filter.completed);
    }
    
    if (filter.goal) {
      filteredTasks = filteredTasks.filter(t => t.goal === filter.goal);
    }
    
    // Sort by creation date (newest first)
    filteredTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return filteredTasks;
  }

  // Get a single task by ID
  getTaskById(id) {
    return this.tasks.find(t => t.id === id);
  }

  // Update a task
  updateTask(id, updates) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return false;
    
    this.tasks[taskIndex] = {
      ...this.tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.saveTasks();
    return this.tasks[taskIndex];
  }

  // Delete a task
  deleteTask(id) {
    const taskIndex = this.tasks.findIndex(t => t.id === id);
    if (taskIndex === -1) return false;
    
    this.tasks.splice(taskIndex, 1);
    this.saveTasks();
    return true;
  }

  // Toggle task completion
  toggleTaskCompletion(id) {
    const task = this.getTaskById(id);
    if (!task) return false;
    
    return this.updateTask(id, {
      completed: !task.completed
    });
  }

  // Get statistics
  getStatistics() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    const pending = total - completed;
    
    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? (completed / total) * 100 : 0
    };
  }

  // Clear all tasks (for testing/reset)
  clearAllTasks() {
    this.tasks = [];
    this.nextId = 1;
    return this.saveTasks();
  }
}

// Export singleton instance
module.exports = new TaskService();