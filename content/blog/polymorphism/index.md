+++
title = "A faster, more flexible alternative to run-time polymorphism in C++ feat. Rust"
date  = "2024-02-10"
+++

When I first heard about run-time polymorphism in C++ using virtual methods, my
first thoughts was like: "This is cool and all but why would I ever use this."
then I continued to ignore it because I can always just work around instead of
using it. Until recently my college lecturer told me that virtual methods is
great for designing and maintaining applications with thousands of objects, I
figured that I should write about what run-time polymorphism is, and why I
think that there are better alternatives to it.

<!-- more -->

# A brief introduction to polymorphism in C++

Polymorphism means "many-shape", and in programming it means designing an API
that works with multiple "shapes" of input, for example, a function that takes
multiple data-type. Consider the following function:

```c++
template<class T1, T2>
double add_area(T1 shape1, T2 shape2) {
  return shape1.area() + shape2.area();
}
```

This function is polymorphic because it works with any data-type with a member
function `area`. However, the template arguments `T1` and `T2` needs to be
determined at compile-time, so we only achieved compile-time polymorphism.
Run-time polymorphism is a bit complicated:

```c++
class Shape {
public:
  Shape() {}
  
  virtual double area() const = 0;
  virtual ~Shape() = default;
};

double add_area(Shape *shape1, Shape *shape2) {
  return shape1->area() + shape2->area();
}
```

The `Shape` class is called an "abstract" class, which means that it can't be
allocated and can only serves as an interface for other classes to inherit
from. Which means that the function `add_area` takes two pointers that point to
two arbitrary objects that inherits from the `Shape` class. What make this
different from the previous example is that this is an actual function, not a
template, and the objects that those pointers point to is determined at
run-time, not at compile-time.

```c++
Shape *shape1 = random_bool() ? new Square(4) : new Circle(2);
Shape *shape2 = random_bool() ? new Square(4) : new Circle(2);

std::cout << add_area(shape1, shape2) << '\n';

delete shape1;
delete shape2;
```

# A simple example

Run-time polymorphism is often used when the data-type is not known at compile
time. Maybe the user want to select what type of shape to add the area
together. Let's extend the previous example to include run-time data, you have
to import the shapes from a file. For demonstration purpose the file format is
extremely simple, it's a text file with every line contains a string
representing the shape type, and floating point numbers representing the shape
attributes. The shape types, their attributes and how to compute the area is
described in the table below:

| shape type  | attributes    | area formula         |
| ----------- | ------------- | -------------------- |
| "square"    | side          | side * side          |
| "rectangle" | width, height | width * height       |
| "circle"    | radius        | radius * radius * PI |
| "triangle"  | 3 sides       | Heron's formula[^1]  |

[^1]: <https://en.wikipedia.org/wiki/Heron's_formula>

We can't tell what shape they are until we have read the file at run-time. So
to get the total area of the entire file, we need a run-time polymorphic
function:

```c++
double total_area(Shape **shapes, size_t shapes_len) {
  double result = 0;

  for (size_t i = 0; i < shapes_len; ++i) {
    result += shapes[i]->area();
  }

  return result;
}
```

The `Shape` class is the same as the above, but notice that we need double
pointer indirection, because every shape in the array is still a pointer to the
actual non-abstract shape. This means that every single shape is its own heap
allocation, which is pretty expensive and you can mess up if you're not careful.
So instead of using raw pointers here is a safer and potentially faster version
of the previous function:

```c++
double total_area(std::span<std::unique_ptr<Shape>> shapes) {
  double result = 0;

  for (std::unique_ptr<Shape> &shape : shapes) {
    result += shape->area();
  }

  return result;
}
```

It's arguably uglier but the `std::unique_ptr` saves us from the hassle of
cleaning up memory and since we're using smart pointers anyways I'm throwing in
`std::span` -- a new C++20 feature -- as well so we don't have to pass in the
length, we can use the range-based for loop for iteration, and the function
automatically works with `std::vector`s.

```c++
std::vector<std::unique_ptr<Shape>> shapes;

shapes.push_back(std::make_unique<Square>(4));
shapes.push_back(std::make_unique<Circle>(2));
shapes.push_back(std::make_unique<Rectangle>(3, 4));
shapes.push_back(std::make_unique<Triangle>(3, 4, 5));

std::cout << total_area(shapes) << '\n'; // 46.566370614359172
```

This is great! It automatically figure out how to compute the area for every
shape that we throw at it, we don't need to manually handle every single case,
and even though the shapes are heap allocated `std::unique_ptr`, makes working
with them less painful. Also notice how I didn't show a single line of code on
how to compute the area, because with polymorphism it actually doesn't matter.
But currently we still hard-code the shapes, so this is possible even with
compile-time polymorphism. So let's justify this by importing the shapes from
the file.

```c++
enum class ShapeTypes {
  SQUARE,
  RECTANGLE,
  CIRCLE,
  TRIANGLE
};

static const std::unordered_map<std::string_view, ShapeTypes> shape_map = {
  {"square", ShapeTypes::SQUARE},
  {"rectangle", ShapeTypes::RECTANGLE},
  {"circle", ShapeTypes::CIRCLE},
  {"triangle", ShapeTypes::TRIANGLE}
};

std::vector<std::unique_ptr<Shape>> get_shapes(const char *file_path) {
  std::vector<std::unique_ptr<Shape>> result;
  std::ifstream fin(file_path);

  char type_str[16];

  while (fin >> type_str) {
    switch (shape_map.find(type_str)->second) {
      case ShapeTypes::SQUARE: {
        double side;
        fin >> side;
        result.push_back(std::make_unique<Square>(side));
        break;
      }
      case ShapeTypes::RECTANGLE: {
        double width, height;
        fin >> width >> height;
        result.push_back(std::make_unique<Rectangle>(width, height));
        break;
      }
      case ShapeTypes::CIRCLE: {
        double radius;
        fin >> radius;
        result.push_back(std::make_unique<Circle>(radius));
        break;
      }
      case ShapeTypes::TRIANGLE: {
        double side1, side2, side3;
        fin >> side1 >> side2 >> side3;
        result.push_back(std::make_unique<Triangle>(side1, side2, side3));
        break;
      }
    }
  }

  return result;
}
```

Okay now it's no longer pretty. We tried so hard not to write the code that
handle different shape types, but now when reading the file we can't avoid
writing it. But if we don't import the shape from the files dynamically at
run-time then it's the same as compile-time polymorphism. Also, if we want to
do tweak the function, like for example "Get the total area of all circles and
triangles", we need to update the abstract class to expose more information:

```c++
class Shape {
public:
  Shape() {}
  
  virtual double area() const = 0;
  virtual double is_circle_or_triangle() const = 0;
  virtual ~Shape() = default;
};

double total_area_circles_and_triangles(std::span<std::unique_ptr<Shape>> shapes) {
  double result = 0;

  for (std::unique_ptr<Shape> &shape : shapes) {
    if (shape->is_circle_or_triangle()) {
      result += shape->area();
    }
  }

  return result;
}
```

Then we need to manually implement the new method for all shapes. So run-time
polymorphism sounds great on paper, but in the end we have to manually do lots
of stuffs. I'm probably missing something and I'm happy to have my mind changed
but as of right now I think that run-time polymorphism falls apart when you
really think about it.

# The alternative

The most obvious solution is to just read the file and process it compute the
total area immediately. But let's pretend that we absolutely have to store the
data into an array first, and perform the computation on the stored array.
Maybe we want to do something else with the array other than doing the
computation. So how do we store multiple shapes in the same array without
run-time polymorphism? The answer is to use a data structure known as a
tagged-union. There are `std::variant` in C++ but I think that it's more
convenient to just literally use a tag and a union. In fact, this structure is
so simple that you don't even need any of C++'s features and just write it in
plain C. The only C++ feature I use right now (other than member function) is
`enum class` only because it is scoped and because I'm in C++ anyways.

```c++
struct Shape {
  enum class Types {
    SQUARE,
    RECTANGLE,
    CIRCLE,
    TRIANGLE
  };

  Types tag;

  union {
    struct {
      double side;
    } square;

    struct {
      double width, height;
    } rectangle;

    struct {
      double radius;
    } circle;

    struct {
      double sides[3];
    } triangle;

    double attrs[0];
  };

  double area() const {
    switch (tag) {
      case Types::SQUARE: return square.side * square.side;
      case Types::RECTANGLE: return rectangle.width * rectangle.height;
      case Types::CIRCLE: return circle.radius * circle.radius * M_PI;
      case Types::TRIANGLE: {
        const double *sides = triangle.sides;
        const double s = (sides[0] + sides[1] + sides[2]) * 0.5;

        return sqrt(s * (s - sides[0]) * (s - sides[1]) * (s - sides[2]));
      }
    }

    __builtin_unreachable();
  }
};
```

Before we don't have to care about how the shapes are implemented but now we do
because it's no longer hidden behind abstract classes and virtual methods.
Remember, they're hidden, abstracted away but they're still there, I think that
the code that compute the area in every derived class is the same as the same
code but in the switch cases. Also we have to manually handle different shapes
in the `area` method. But as we saw before manually handling different cases is
inevitable at run-time, so I don't think there's a good reason to avoid it. You
might wonder "What happen when you add a new shape?". Well, just add a new
shape to the enum and the compiler will emit a warning that you haven't handled
all enum values. Constructing a shape is also simple using designated
initializers.

```c++
Shape square = {
  .type = Shape::Types::SQUARE,
  .square = {
    .side = 4
  }
};

Shape triangle = {
  .type = Shape::Types::TRIANGLE,
  .triangle = {
    .sides = {3, 4, 5}
  }
};
```

You can even use a factory function to simplify creation of shapes buf I think
that designated initializers are good enough. One of the downsides of this
approach is reduced type-safety. There's nothing preventing you from accessing
the radius of a square. If you know your union then it's fine but mistakes can
happen and this is one place where you can mess up. Now `Shape` is an actual
class and its instances *are* shapes and not pointers pointing to the actual
shape. This effectively remove one level of indirection and all shapes can be
in the same contiguous memory region.

```c++
double total_area(std::span<Shape> shapes) {
  double result = 0;
  
  for (Shape &shape : shapes) {
    result += shape.area();
  }

  return result;
}
```

Now we don't have to worry about cleaning up individual shape or even have to
use `std::unique_ptr`, and it might even help with performance! But before that
lets see how do we import the shapes from the file.

```c++
static const std::unordered_map<std::string_view, Shape::Types> shape_map = {
  {"square", Shape::Types::SQUARE},
  {"rectangle", Shape::Types::RECTANGLE},
  {"circle", Shape::Types::CIRCLE},
  {"triangle", Shape::Types::TRIANGLE}
};

std::vector<Shape> read_file(const char *file_path) {
  std::vector<Shape> result;
  std::ifstream fin(file_path);

  std::string line;

  while (std::getline(fin, line)) {
    std::stringstream ss(line);
    char type_str[16];
    ss >> type_str;

    Shape shape;
    shape.tag = shape_map.find(type_str)->second;
    
    size_t attrs_len = 0;
    double attr;
    while (ss >> attr) shape.attrs[attrs_len++] = attr;

    result.push_back(shape);
  }

  return result;
}
```

This, in my opinion, is even nicer than the previous implementation. We already
have the `Shape::Types` enum for the tag, so we can easily reused them here.
Remember `double attrs[0]`? It's an array representing the underlying values of
the shape attributes. Because the file is already in the correct order, we can
just push items into that array instead of matching the shape type and
constructing the correct shape. So by having more control over the memory
layout, we can analyze and reduce some repetition. What about the example of
only adding the area of circles and triangles? It's just a single if statement:

```c++
double total_area_circles_and_triangles(std::span<Shape> shapes) {
  double result = 0;
  
  for (Shape &shape : shapes) {
    if (shape.tag == Shape::Types::CIRCLE || shape.tag == Shape::Types::TRIANGLE) {
      result += shape.area();
    }
  }

  return result;
}
```

You don't need to edit all the shapes just to add that. So by not avoiding to
handle different shapes manually we increased the flexibility of our code and
sometimes adding features is easier because of it.

# Benchmark and conclusion

So lets finally get into the performance of these two methods. I generated a
one million shapes of those four types, and measure the time they take to
compute the total area.

| Optimizaion | Polymorphism | Tagged-union |
| ----------- | ------------ | ------------ |
| `-O0`       | 25628us      | 15758us      |
| `-O3`       | 6908us       | 5100us       |

The tagged-union method is 1.6 times faster without optimizations and 1.35
times faster with `-O3` optimization. As you can see the individual heap
allocation and virtual method has a noticable overhead. And this is just 4
different variants and 1 virtual method. The overhead will add up even further.

So, my take is that run-time polymorphism in C++ doesn't actually prevent you
from manually handling all cases at run-time, isn't very flexible, you have to
worry about memory safety, and the performance is worse. You can do the same
thing with tagged-union, it's as easy to add more variants, and have higher
performance. Because of this, I can't see why I should use abstract classes and
virtual method in C++.

# Bonus content: Polymorphism and Tagged-union in Rust

## Polymorphism using Trait

So that's about C++, but what about polymorphism in other languages? In Rust,
methods and other shared behaviour are defined using Trait instead of
inheritance. For example, instead of "Square" and "Circle" inherits "Shape",
"Square" and "Circle" has the trait "Area".

```rust
trait Area {
  fn area(&self) -> f64;
}

struct Square {
  side: f64
}

impl Area for Square {
  fn area(&self) -> f64 {
    self.side * self.side
  }
}
```

Compile-time polymorphism in Rust is also defined using generics like in C++,
but you have to constraint the generic parameter with a trait to access its
methods:

```rust
fn add_area<T1, T2>(shape1: T1, shape2: T2) -> f64
where T1: Area, T2: Area {
  shape1.area() + shape2.area()
}
```

What cool about Rust is that Trait can be thought of as an abstract class or
interface. So for run-time polymorphism, no extra boilerplate is required.
There are also no separation between virtual and regular method like in C++.
The method are instead marked to be "dynamically dispatched" using the `dyn`
keyword.

```rust
fn add_area(shape1: &dyn Area, shape2: &dyn Area) -> f64 {
  shape1.area() + shape2.area()
}
```

Similar to the C++ version, `&dyn Area` just points to an object with the
`Area` trait, but there are differences between Rust polymorphism and C++
polymorphism which I won't go into detail here. To determine the type at
run-time, you actually need to use a "boxed trait", which is heap-allocated,
also similar to C++.

```rust
let shape1: Box<dyn Area> = if random_bool() {
    Box::new(Square { side: 4.0 })
} else {
    Box::new(Circle { radius: 2.0 })
};

let shape2: Box<dyn Area> = if random_bool() {
    Box::new(Square { side: 4.0 })
} else {
    Box::new(Circle { radius: 2.0 })
};

dbg!(add_area(shape1.as_ref(), shape2.as_ref()))
```

I really like Rust trait, it makes compile-time and run-time polymorphism feels
very similar. Because the methods are guaranteed to exists you have better
editor completion than in C++. The error messages are also nicer. You can add
traits to existing types, or even primitive ones, so you can have `((2 - 5) as
i32).abs()`.

## Enum as tagged-union

Now for tagged-union. In rust they are implemented as enum, and they are much,
much more pleasant to use than their C++ counterpart.

```rust
enum Shapes {
  Square(f64),
  Rectangle(f64, f64),
  Circle(f64),
  Triangle(f64, f64, f64)
}
```

You don't have as much control over the memory layout as you do in C++, but it
is completely type-safe as you have to pattern-match the enum to get the
underlying data.

```rust
impl Area for Shapes {
  fn area(&self) -> f64 {
    match self {
      Shapes::Square(side) => side * side,
      Shapes::Rectangle(width, height) => width * height,
      Shapes::Circle(radius) => radius * radius * f64::consts::PI,
      Shapes::Triangle(side1, side2, side3) => {
        let s = 0.5 * (side1 + side2 + side3);
        (s * (s - side1) * (s - side2) * (s - side3)).sqrt()
      },
    }
  }
}
```

Rust enum is extremely convenient and is the backbone of many features such as
`Option` or `Result`. While I don't have as much controls as in C++, because
enum is a built-in language feature of Rust, constructing and accessing them
feel so much more natural.

```rust
let square = Shapes::Square(4.0);

if let Square(side) = square {
    dbg!(side);
}
```

Compare this to the C++ version:

```c++
// I can write and use a factory function but still I have to write more code
Shape square = {
  .tag = Shape::Types::SQUARE,
  .square = {
    .side = 4
  }
};

if (square.tag == Shape::Types::SQUARE) {
  std::cout << square.square.side << '\n';

  // Nothing prevents me from doing this
  std::cout << square.rectangle.height << '\n';
}
```

I still prefer this over `std::variant`, and definitely prefer this over using
run-time polymorphism, but I think that Rust enum are superior with its safety
and convenience.
