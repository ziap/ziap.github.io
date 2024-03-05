+++
title = "My small, memorable, random number generator"
date  = "2024-03-05"
+++

I use (pseudo-)random number generators (RNGs) all the time. They're an
essential part of my code. Recently, I prefer using a custom generator instead
of the default ones because:

- NumPy's new [Generator
API](//numpy.org/doc/stable/reference/random/generator.html#numpy.random.Generator)
feels so much better than the old global API.
- The default ones are often too big and slow, for example, C++'s
[std::mt199937](//en.cppreference.com/w/cpp/numeric/random/mersenne_twister_engine).

There are plenty of custom generators to choose from, but I still designed one
myself so that I can quickly code one from memory whenever I need to.

<!-- more -->

# The generator

If you just want to see the generator, here it is:

```c
const uint64_t MUL = 0x9e3779b97f4a7c55;

uint32_t rng_next(uint64_t *state) {
    uint64_t s = *state;
    *state = s * MUL + 1;

    uint64_t w = (s ^ (s >> 24)) * (s ^ MUL);
    return (w ^ (w >> 24)) >> 32;
}
```

It is an RNG based on the [PCG family](//www.pcg-random.org) of pseudo-random
number generators by Dr. M.E. O'Neill. The generator can be split into two
parts: the Linear Congruential Generator and the output mixing/permutation.

## The Linear Congruential Generator

The Linear Congruential Generator is defined by the following recurrence
relation:

```
x[n] = (x[n - 1] * MUL + INC) % MOD
```

Choosing `MOD` and `INC` is easy. Because C uses wrapping addition and
multiplication by default, we don't have to even choose `MOD`. Using `uint64_t`
for the state is equivalent to choosing `2^64` for `MOD`. `INC` can be any odd
number, so I choose `1` because I'm boring, and because I need to remember it.

Choosing `MUL` is a bit trickier. There are some constraints that I won't go
into detail about, but here's a formula for `MUL` that I can easily evaluate
using Python.

```python
MUL = isqrt(5 * 2 ** (63 * 2)) - 2 ** 63 + 64
```

This gives the number shown in hexadecimal above. To remember the formula, I
just have to remember that `MUL * ϕ = MOD` where `ϕ` is the [golden
ratio](//en.wikipedia.org/wiki/Golden_ratio), and the hexadecimal
representation of `MUL` ends with `0x55`. This is not a great multiplier, but
its weaknesses will be masked by a good output permutation.

## Output permutation
 
The output permutation is inspired by the `RXS-M-XS` and `DXSM` permutation
functions from the PCG family. It violated several of Dr. O'Neill's rules for
designing an output permutation. Read [her
paper](//www.pcg-random.org/pdf/hmc-cs-2014-0905.pdf) to learn more. However,
the output permutation is easy to remember, decently fast and has good
statistical quality. It can be broken down into three steps:

```c
uint32_t output(uint64_t s) {
    // xorshift
    uint64_t w = (s ^ (s >> 24));
    // xor-multiply
    w *= s ^ MUL;
    // xorshift-truncate
    return (w ^ (w >> 24)) >> 32;
}
```

# Is it good?

## Speed and size

Compiling down to x86 with clang17 and `-O3 -march=native`, this is the
generated assembly of the output permutation of `RXS-M-XS`, `XSH-RR`, and my
custom RNG.

```asm
pcg_custom:                             # @pcg_custom
    mov     rax, rdi
    shr     rax, 24
    xor     rax, rdi
    movabs  rcx, -7046029254386353067
    xor     rcx, rdi
    imul    rcx, rax
    mov     rax, rcx
    shr     rax, 56
    shr     rcx, 32
    xor     eax, ecx
    ret
pcg_rxs_m_xs:                         # @pcg_rxs_m_xs
    mov     rax, rdi
    shr     rax, 59
    add     al, 5
    shrx    rax, rdi, rax
    xor     rax, rdi
    movabs  rcx, -5840758589994634535
    imul    rcx, rax
    mov     rax, rcx
    shr     rax, 54
    shr     rcx, 32
    xor     eax, ecx
    ret
pcg_xsh_rr:                             # @pcg_xsh_rr
    mov     rcx, rdi
    mov     rax, rdi
    shr     rax, 45
    mov     rdx, rdi
    shr     rdx, 27
    xor     eax, edx
    shr     rcx, 59
    ror     eax, cl
    ret
```

As you can see, my output permutation has one less instruction than `RXS-M-XS`,
but two more than `XSH-RR`. So in theory, it's slightly faster than `RSH-M-XS`
but slightly slower than `XSH-RR`. Moreover, multiplication is expensive, and
the `XSH-RR` version doesn't have one, so it might be even faster. I don't have
a good way to actually measure the speed of these RNGs, so showing the
generated assembly is the best that I can do.

## Quality

My generator easily passes
[BigCrush](//simul.iro.umontreal.ca/testu01/tu01.html). Passing statistical
tests doesn't mean that the generator has good quality, but failing them 
doesn't sound good for your RNG. Dr. O'Neill suggests testing a scaled-down
version, to make sure that the generator isn't too big for statistical flaws to
be detected. So I created a 36-bit version of the generator and tested it. The
result is that it also passes BigCrush, which means that the generator I
designed is a good generator for its size.

# Conclusion

This is just a random number generator I designed for fun, and for when I need
to quickly make one from memory. I still use and recommend using the PCG
`XSH-RR` variant instead, because it's faster and more well-tested. PCGs are
not optimal for generating 64-bit numbers for various reasons, but for
32-bit---which I mostly ever need---they are incredible. I highly recommend
reading Dr. O'Neill's [blog](//www.pcg-random.org/blog/) and
[paper](//www.pcg-random.org/pdf/hmc-cs-2014-0905.pdf) to learn more about
RNGs. And be sure to check out other generators, such as
[Xoshiro256++](//prng.di.unimi.it/),
[SFC64](//pracrand.sourceforge.net/RNG_engines.txt), and
[WyRand](//github.com/wangyi-fudan/wyhash).
