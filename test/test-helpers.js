const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function makeUsers(){
    return [
        {
            id: 1,
            first_name: 'Dunder',
            last_name: 'Mifflin',
            user_name: 'dunder_mifflin',
            password: 'Password1!',
            date_created: '2029-01-22T16:28:32.615Z',
        },
    ];
};

function createMenu(users){
    return [
        {id: 1, name: "Sausage, Eggs, Biscuit, & Hashbrowns", user_id: users[0].id, image_url:"https://media-cdn.tripadvisor.com/media/photo-s/07/1d/2a/a7/spooner-family-restaurant.jpg", calories: 750, carbs: 53, protein: 25, fat: 49, category: "Breakfast"},
        {id: 2, name: "Breakfast Burrito", user_id: users[0].id, image_url:"https://www.tasteofhome.com/wp-content/uploads/2018/01/Sausage-Breakfast-Burritos_EXPS_SDDJ19_1760_C07_20_1b.jpg", calories: 300, carbs: 26, protein: 13, fat: 16, category: "Breakfast"},
        {id: 3, name: "Pancakes", user_id: users[0].id, image_url:"https://th.bing.com/th/id/OIP.PxQhB5NydJk5bG6K0oqndgHaKK?pid=Api&rs=1", calories: 590, carbs: 102, protein: 9, fat: 15, category: "Breakfast"},
    
        {id: 4, name: "Tuna Sandwich", user_id: users[0].id, image_url:"https://www.simplyrecipes.com/wp-content/uploads/2018/07/Add-ins-for-tuna-salad-3.jpg", calories: 450, carbs: 38, protein: 19, fat: 25, category: "Lunch"},
        {id: 5, name: "Chicken Nuggets", user_id: users[0].id, image_url:"https://www.tasteofhome.com/wp-content/uploads/2018/01/exps168399_TH163620D11_12_6b.jpg", calories: 830, carbs: 51, protein: 46, fat: 49, category: "Lunch"},
        {id: 6, name: "Cheeseburger", user_id: users[0].id, image_url:"https://www.sbs.com.au/food/sites/sbs.com.au.food/files/lotus-burger-lead.jpg", calories: 360, carbs: 37, protein: 17, fat: 15, category: "Lunch"},
    
        {id: 7, name: "Chicken Parmigiana", user_id: users[0].id, image_url:"http://www.cookingclassy.com/wp-content/uploads/2013/02/chicken-parmsesan6.jpg", calories: 570, carbs: 40, protein: 58, fat: 18, category: "Dinner"},
        {id: 8, name: "Spaghetti & Meatballs", user_id: users[0].id, image_url: "https://www.kitchensanctuary.com/wp-content/uploads/2016/02/One-pan-spaghetti-and-meatballs-tall.jpg", calories: 620, carbs: 50, protein: 26, fat: 34, category: "Dinner"},
        {id: 9, name: "Ribeye Steak", user_id: users[0].id, image_url:"https://www.harrisranch.com/wp-content/uploads/2019/01/photo_ribeye_steak4SMALL_1024x1024.jpg", calories: 810, carbs: 0, protein: 96, fat: 54, category: "Dinner"},
    ];
};

function createPlanItem(users, items){
    return [
        { 
          id: 1,
          menu_item_id: items[0].id, 
          user_id: users[0].id, 
        }
    ];
};

function makeMaliciousMenuItem(user){
    const maliciousMenuItem = {
        id: 1, 
        name: 'Sausage, Eggs, Biscuit, & <script>alert("xss");</script>',
        user_id: user.id, 
        image_url:"https://insecure-website.com/status?message=<script>alert('xss');</script>",
        calories: 750,
        carbs: 53, 
        protein: 25,
        fat: 49,  
        category: "Breakfast"
    };

    const expectedMenuItem = {
        ...maliciousMenuItem,
        name: 'Sausage, Eggs, Biscuit, & &lt;script&gt;alert(\"xss\");&lt;/script&gt;',
        image_url: "https://insecure-website.com/status?message=&lt;script&gt;alert('xss');&lt;/script&gt;"
    };

    return {
        maliciousMenuItem,
        expectedMenuItem
    };

};

function makeItemsFixtures(){
    const testUsers = makeUsers();
    const testItems = createMenu(testUsers);
    const testPlanItem = createPlanItem(testUsers, testItems);
    return { testUsers, testItems, testPlanItem };
};

function cleanTables(db) {
    return db.transaction(trx =>
        trx.raw(
        `TRUNCATE
            menu_tb,
            users_tb,
            plan_tb
            RESTART IDENTITY CASCADE`
        )
  );
};

function seedUsers(db, users) {
    const preppedUsers = users.map(user => ({
        ...user,
        password: bcrypt.hashSync(user.password, 12)
    }));
    return db.into('users_tb').insert(preppedUsers)
    .then(() =>
        // update the auto sequence to stay in sync
        db.raw(
            `SELECT setval('users_tb_id_seq', ?)`,
            [users[users.length - 1].id],
        )
    )
    .catch(error => console.log(error));
};

function seedTables(db, users, items, planItems=[]) {

    //use a transaction to group the queries and auto rollback on any failure 
    return db.transaction(async trx => {
        try {
            await seedUsers(trx, users);
            await trx.into('menu_tb').insert(items);
            //update the auto sequence to match the forced id values
            await trx.raw(
                `SELECT setval('menu_tb_id_seq', ?)`,
                [items[items.length -1].id]
            )  
            //only inserts plan items if there are some
            if(planItems.length){
                await trx.into('plan_tb').insert(planItems);
            } 
        } catch(e){
            console.log("error", e);
        };
    });  
};

function seedMaliciousItem(db, user, item) {
      return seedUsers(db, [user])
         .then(() =>
            db
              .into('menu_tb')
              .insert([item])
      );
};

function makeAuthHeader(user, secret = process.env.JWT_SECRET) {
    const token = jwt.sign(
        { user_id: user.id }, //payload
        secret, //secret
        {
          subject: user.user_name,
          expiresIn: process.env.JWT_EXPIRY,
          algorithm: 'HS256',
        })
        return `Bearer ${token}`;
};

module.exports = {
    makeUsers,
    createMenu,
    createPlanItem, 
    makeMaliciousMenuItem,
    
    makeItemsFixtures,
    cleanTables,
    seedUsers,
    seedTables,
    seedMaliciousItem,
    makeAuthHeader,
};




