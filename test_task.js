// Test script for Task Service
const taskService = require('./src/main/taskService');

console.log('=== Task Service Test ===');

async function testInitialization() {
  console.log('\n--- Testing Initialization ---');
  try {
    // taskService is already instantiated (singleton)
    console.log('✓ Task Service imported successfully');
    
    // Check if methods exist
    console.log(`has addTask: ${typeof taskService.addTask === 'function'}`);
    console.log(`has getTasks: ${typeof taskService.getTasks === 'function'}`);
    console.log(`has decomposeGoal: ${typeof taskService.decomposeGoal === 'function'}`);
    
    return taskService;
  } catch (error) {
    console.error('✗ Error initializing Task Service:', error);
    return null;
  }
}

async function testAddTask(taskService) {
  console.log('\n--- Testing Add Task ---');
  try {
    const task = taskService.addTask({
      title: 'Test task',
      completed: false
    });
    console.log(`Added task: ${JSON.stringify(task)}`);
    
    const tasks = taskService.getTasks();
    console.log(`Total tasks: ${tasks.length}`);
  } catch (error) {
    console.error('✗ Error in addTask:', error);
  }
}

async function testDecomposeGoal(taskService) {
  console.log('\n--- Testing Goal Decomposition ---');
  try {
    const goals = [
      'Write an email to the team',
      'Prepare a presentation for the meeting',
      'Organize the project timeline',
      'Learn a new programming language'
    ];
    
    for (const goal of goals) {
      console.log(`\nGoal: ${goal}`);
      const tasks = await taskService.decomposeGoal(goal);
      console.log(`Decomposed into ${tasks.length} tasks:`);
      tasks.forEach((task, index) => {
        console.log(`  ${index + 1}. [${task.completed ? 'x' : ' '}] ${task.title}`);
      });
    }
  } catch (error) {
    console.error('✗ Error in decomposeGoal:', error);
  }
}

async function testAddTasksFromGoal(taskService) {
  console.log('\n--- Testing Add Tasks from Goal ---');
  try {
    const goal = 'Plan a weekend trip';
    const tasks = taskService.addTasksFromGoal(goal);
    console.log(`Added ${tasks.length} tasks from goal: ${goal}`);
    
    const allTasks = taskService.getTasks();
    console.log(`Total tasks now: ${allTasks.length}`);
    
    // Show the last added tasks
    console.log('Last added tasks:');
    tasks.forEach((task, index) => {
      console.log(`  ${index + 1}. [${task.completed ? 'x' : ' '}] ${task.title}`);
    });
  } catch (error) {
    console.error('✗ Error in addTasksFromGoal:', error);
  }
}

async function testUpdateAndDelete(taskService) {
  console.log('\n--- Testing Update and Delete ---');
  try {
    // Add a task
    const task = taskService.addTask({
      title: 'Task to update and delete',
      completed: false
    });
    console.log(`Added task with ID: ${task.id}`);
    
    // Update the task
    const updated = taskService.updateTask(task.id, {
      title: 'Updated task title',
      completed: true
    });
    console.log(`Updated task: ${JSON.stringify(updated)}`);
    
    // Delete the task
    const deleted = taskService.deleteTask(task.id);
    console.log(`Deleted task: ${deleted}`);
    
    // Check if it's gone
    const remaining = taskService.getTasks();
    console.log(`Remaining tasks: ${remaining.length}`);
  } catch (error) {
    console.error('✗ Error in update/delete:', error);
  }
}

async function testStatistics(taskService) {
  console.log('\n--- Testing Statistics ---');
  try {
    // Add a few tasks with different completion statuses
    taskService.addTask({ title: 'Completed task', completed: true });
    taskService.addTask({ title: 'Pending task 1', completed: false });
    taskService.addTask({ title: 'Pending task 2', completed: false });
    
    const stats = taskService.getStatistics();
    console.log(`Statistics: ${JSON.stringify(stats)}`);
  } catch (error) {
    console.error('✗ Error in statistics:', error);
  }
}

async function runAllTests() {
  try {
    const taskService = await testInitialization();
    if (taskService) {
      await testAddTask(taskService);
      await testDecomposeGoal(taskService);
      await testAddTasksFromGoal(taskService);
      await testUpdateAndDelete(taskService);
      await testStatistics(taskService);
    }
    console.log('\n✓ All task service tests completed!');
  } catch (error) {
    console.error('\n✗ Test failed:', error);
  }
}

runAllTests();