+++
title = "The frequency queue data structure"
date  = "2026-09-30"
+++

My [previous endeavor into byte pair encoding](/blog/bpe-1) didn't go anywhere
worth writing about, but it posed an interesting problem: design a data
structure from which you can query and remove the mode, or the element that
appears most often. We can treat the number of appearances, or frequency, as a
priority and use a binary heap for O(log n) operations. But we can exploit
certain properties of frequencies to do better. This article introduces a
"frequency queue" data structure with O(1) operations that is arguably easier
to implement than a binary heap.

<!-- more -->

# Context

Byte pair encoding repeatedly searches for the bi-gram with the highest
frequency, then replaces all of them with a new token. So we need a data
structure that can:

- Get the pair with the highest frequency
- Update the pairs and their frequencies after merging

So we need to support:

```python
histogram.insert(pair)
histogram.remove(pair)
histogram.get_max() -> pair
```

Note that after every insertion, the frequency of a pair increases, and after
every removal, the frequency decreases. We can implement this using a hash
table as follows:

```ts
class Histogram<T> {
  readonly freqs = new Map<T, number>()
  
  insert(key: T): void {
    const freq = this.freqs.get(key) ?? 0
    this.freqs.set(key, freq + 1)
  }
  
  remove(key: T): void {
    const freq = this.freqs.get(key)
    if (freq === undefined) return
    if (freq === 1) {
      this.freqs.delete(key)
    } else {
      this.freqs.set(key, freq - 1)
    }
  }
  
  get_max(): T | undefined {
    let result: [T, number] | undefined;

    for (const entry of this.freqs.entries()) {
      if (entry[1] > (result?.[1] ?? 0)) {
        result = entry
      }
    }

    return result?.[0]
  }
}
```

This gives us O(1) insertion and removal, but at the cost of O(n) get_max,
which is usually more expensive than your typical array scan O(n) since we're
iterating a hash table.

## Bucket queue

In a [previous
project](/blog/sliding-puzzle#attempt-3-uniform-cost-graph-optimization), I
exploited how the A* heuristic only changes by `+ 0` or `+ 2` to store the
frontier in two separate buckets for an O(1) priority queue. The same can also
apply here: we can always track the maximum frequency and allocate the
corresponding number of buckets. 

```ts
class BucketQueue<T> {
  readonly freqs = new Map<T, number>()
  readonly buckets: Set<T>[] = [new Set()]
  
  insert(key: T): void {
    const freq = this.freqs.get(key)
    if (freq === undefined) {
      this.freqs.set(key, 1)
      this.buckets[0].add(key)
    } else {
      this.buckets[freq - 1].delete(key)
      if (this.buckets.length <= freq) {
        this.buckets.push(new Set())
      }
      this.buckets[freq].add(key)
      this.freqs.set(key, freq + 1)
    }
  }
  
  remove(key: T): void {
    const freq = this.freqs.get(key)
    if (freq === undefined) return
    this.buckets[freq - 1].delete(key)
    
    if (freq > 1) {
      this.buckets[freq - 2].add(key)
      this.freqs.set(key, freq - 1)
    } else {
      this.freqs.delete(key)
    }
  }
  
  get_max(): T | undefined {
    while (this.buckets.length > 1) {
      const last = this.buckets[this.buckets.length - 1]
      for (const item of last) {
        return item
      }
      this.buckets.pop()
    }

    for (const item of this.buckets[0]) {
      return item
    }

    return undefined
  }
}
```

Insertion and removal boil down to just:

- Remove the key from its current frequency bucket
- Insert it into the next/previous frequency bucket
- Update the frequency map
- Extra handling for adding new items or removing items with 0 frequency

And getting max becomes finding the highest non-empty bucket and returning the
first item. This can be proven to be amortized O(1) over deletion calls. Note
that `get_max` needs to handle the first bucket separately so that it's always
available for new unique insertions (frequency 1).

## Use arrays for buckets

The data structure works, but storing an array of sets isn't very good in terms
of data layout. Note that although I'm using TypeScript as an example in this
article, I wanted this data structure to be easy to implement in lower level
languages. Let's first think about whether the inner Set is really needed. We
need these two properties of a set:

- Semantically, a container of unique, unordered elements
- O(1) insertion and deletion

Let's address uniqueness first. Note that we already handled this using the
outer Map during insertion:

```ts
function insert(key: T): void {
  const freq = this.freqs.get(key)
  if (freq === undefined) {
    // insert a new key
  } else {
    // increase frequency of an existing key
  }
}
```

So the inner data structure doesn't need to handle uniqueness itself. If you
don't need uniqueness, a plain `Array` is usually a better choice. Because the
container is unordered, we don't care whether `a[i] === key`, but rather
`a.includes(key) === true`. We don't need a membership test, so this is fine.
The key just has to be stored somewhere.

O(1) insertion is possible using `.push`, so the remaining gap is O(1)
arbitrary removal. This can be done using the swap-remove operation. The idea
is to replace it with the last element, then perform the O(1) `.pop`. This
tampers with the ordering of the elements in the array, but remember that our
container is *unordered*. All that's left is some extra bookkeeping to make
sure that the references remain valid.

```ts
type Entry = {
  freq: number,
  offset: number,
}

class BucketQueue<T> {
  readonly map = new Map<T, Entry>()
  readonly buckets: T[][] = [[]]

  private removeFromBucket(entry: Entry): void {
    const bucket = this.buckets[entry.freq - 1]

    if (entry.offset !== bucket.length - 1) {
      const last = bucket[bucket.length - 1]
      bucket[entry.offset] = last
      this.map.set(last, entry)
    }

    bucket.pop()
  }

  private addToBucket(key: T, freq: number): void {
    const bucket = this.buckets[freq - 1]
    const offset = bucket.length
    this.map.set(key, { offset, freq })
    bucket.push(key)
  }
  
  insert(key: T): void {
    const entry = this.map.get(key)
    if (entry === undefined) {
      this.addToBucket(key, 1)
    } else {
      this.removeFromBucket(entry)

      if (this.buckets.length <= entry.freq) {
        this.buckets.push([])
      }

      this.addToBucket(key, entry.freq + 1)
    }
  }
  
  remove(key: T): void {
    const entry = this.map.get(key)
    if (entry === undefined) return

    this.removeFromBucket(entry)

    if (entry.freq > 1) {
      this.addToBucket(key, entry.freq - 1)
    } else {
      this.map.delete(key)
    }
  }
  
  get_max(): T | undefined {
    // same as before
  }
}
```

Using arrays instead of sets should reduce the memory and lookup overhead, at
the cost of more complex bucket management. This is better already, but we're
still allocating an entire array for each frequency level, which is not good.
The current data structure allows inserting to and removing from buckets
arbitrarily, but that's not something we really need. Just like the ordering,
when there's something that we don't need, we can remove it to gain something
else. And this leads us to:

# The frequency queue

One of my favorite ways to store jagged arrays is to store them contiguously in
a backing array, and have an array of offsets to index into it. For example,
the array:

```json
[
  [1, 2, 3],
  [4, 5, 6, 7],
  [8, 9],
]
```

can be stored as:

```json
{
  buffer: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  offsets: [0, 3, 7, 9]
}
```

Indexing `a[i][j]` becomes `a.buffer[a.offsets[i] + j]`, and row length
`a[i].length` becomes `a.offsets[i + 1] - a.offsets[i]`. An obvious downside to
this is that you can't resize or just append to individual arrays. Usually, I
build the entire jagged array in one pass and use it as an immutable array, but
that's not applicable here.

Recall that we don't need arbitrary bucket insertion/removal. We only need to
move items between adjacent buckets. A constraint that we haven't taken
advantage of is that during insertion, a key can only be:

- Inserted into frequency 1
- Moved from frequency N to frequency N + 1 (promotion)

Similarly, with removal, a key can only be:

- Removed from the container if it's in frequency 1
- Moved from frequency N to frequency N - 1 (demotion)

We established that modification at the end is very cheap using push for
insertion and swap-remove for removal, so it makes sense to put frequency 1 at
the end of the array. It also makes a lot of sense to put the highest frequency
at the start of the array, so getting the most frequent element is just `a[0]`,
similar to a binary heap. In fact, let's store the elements in descending
frequencies, for example:

```jsx
Indices:       0      1      2      3      4      5      6      7
            ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
keys:       │  A   │  B   │  C   │  D   │  E   │  F   │  G   │  H   │
            ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
freqs:      │  4   │  4   │  3   │  2   │  2   │  2   │  1   │  1   │
            └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

If we can maintain a structure like this, the internals feel very similar to a
priority queue where items get pushed in and sifted up until they reach the
front of the queue. This is why I dubbed this the frequency queue. The
remaining problem is to implement the adjacent frequency update operations.

Sometimes it's useful to think of the general case as, well, *generalization*
of the edge case. So first, let's consider the two operations -- push to back
and swap remove -- as used in the edge cases and see why they work. This means
we should look into:

## Recontextualizing dynamic arrays

Along with the hash table, the dynamic array is a data structure so ubiquitous
that it's often taken for granted, and rightfully so. Being able to push and
pop the end in (amortized) O(1) is a big deal, and here's how it is usually
implemented (I also covered this in [an earlier
post](/blog/queue#dynamic-array-based-stack)). Usually the language runtime or
standard library gives you some extra *reserved* memory at the end of the array
so that pushing to the end doesn't ask for memory — which is an expensive
operation — all the time. The array length is also tracked independently from
the size of the reserved memory to know which elements are reserved and which
elements are currently being used.

Note how the actual, allocated array is partitioned here. Pushing to the end
can be thought of as making the **first** element of the reserved partition
part of the used partition, and sliding the boundary **right**, increasing the
used partition size by 1 and decreasing the reserved partition size by 1.
Similarly, the swap-remove operation can be thought of as moving the removed
element to the end of the used partition, and sliding the boundary **left** to
make it the first element of the reserved partition instead.

## Generalizing to frequency update

So push-back and swap-remove are also frequency updates, but for frequency
group 1 and an implicit frequency group 0 in the reserved partition of the
array! Pushing is moving from group 0 to group 1, so to generalize it, i.e.
moving an element from group N to group N + 1, we can:

- Make the element the first element in group N
- Slide the boundary of group N + 1 **to the right**, increasing the size of
  group N + 1 and decreasing the size of group N

Similarly, for moving an element from group N to group N - 1, we can:

- Make the element the last element in group N
- Slide the boundary of group N **to the left**, increasing the size of group
  N - 1 and decreasing the size of group N

Making the element the first or last of a group can be implemented by swapping
with the actual first/last element. This is possible because again, the
ordering between elements within a group isn't required. This gives us the
following implementation:

```ts
class FrequencyQueue<T> {
  readonly index_map = new Map<T, number>()
  readonly offsets: number[] = []
  readonly keys: T[] = []
  readonly freqs: number[] = []

  private swapIndex(index: number, target: number): void {
    if (target !== index) {
      const key = this.keys[index]
      const tmp = this.keys[target]
      this.keys[target] = key
      this.keys[index] = tmp
      this.index_map.set(tmp, index)
      this.index_map.set(key, target)
    }
  }

  insert(key: T): void {
    const index = this.index_map.get(key)
    if (index === undefined) {
      this.index_map.set(key, this.keys.length)
      this.keys.push(key)
      this.freqs.push(1)
    } else {
      const freq = this.freqs[index]
      if (this.offsets.length < freq) {
        this.offsets.push(0)
      }

      const target = this.offsets[freq - 1]
      this.offsets[freq - 1] += 1

      this.swapIndex(index, target)
      this.freqs[target] += 1
    }
  }

  remove(key: T): void {
    const index = this.index_map.get(key)
    if (index === undefined) return

    const freq = this.freqs[index]
    if (freq > 1) {
      const target = this.offsets[freq - 2] - 1
      this.offsets[freq - 2] -= 1

      this.swapIndex(index, target)
      this.freqs[target] -= 1
    } else {
      const tmp = this.keys[this.keys.length - 1]
      this.keys[index] = tmp
      this.index_map.set(tmp, index)
      this.index_map.delete(key)
      this.keys.pop()
      this.freqs.pop()
    }
  }

  get_max(): T | undefined {
    return this.keys.at(0)
  }
}
```

Notice how all the complexity of scanning down the array has been completely
eliminated, and `get_max` becomes just indexing the first element. In fact,
since the groups are sorted in descending frequency and stored contiguously,
the `keys` are also stored in descending frequency order! That's a neat
invariant that we get for free with this representation. Let's bring this data
structure into practice.

# Solving Leetcode problems

## Top K Frequent Elements

> Given an integer array `nums` and an integer `k`, return *the* `k` *most
> frequent elements*. You may return the answer in **any order**.

The standard approach would be to collect into a multiset, group by frequency,
then concatenate the highest frequency groups until at least k elements are
collected. All of this is built into the frequency queue, so the implementation
is as simple as:

```ts
function maxFrequency(nums: number[], k: number): number {
  const hist = new FrequencyQueue<number>()
  for (const num of nums) hist.insert(num)
  return hist.keys.slice(0, k)
}
```

Since the keys are sorted by frequency, getting the top K most frequent
elements can be done by simply slicing the array.

## LFU Cache

The problem description is a bit lengthy, so it's better to [read
it](https://leetcode.com/problems/lfu-cache/description/) yourself.
Essentially, the task is to build a cache that evicts the least frequently used
(LFU) item. If multiple items are equally frequently used, the least
**recently** used (LRU) item among those items is evicted instead.

Without the tie-breaking requirement, the data structure can be modified to
store (key, value, frequency) triplets and be used directly. But LRU means that
we need to keep track of the insertion *order*, something that we deliberately
traded by using arrays.

This is a good opportunity to investigate what is needed when insertion order
is important, specifically to **remove the nested dynamic container layout**.
Insertion-order-preserving hash tables (such as JavaScript's `Set`) can be
implemented by storing entries in a doubly linked list. So we can implement that
manually instead of piggybacking off of `Set`.

```ts
class Node {
  prev: Node | null = null
  next: Node | null = null

  constructor(
    public key: number,
    public value: number,
    public freq: number,
  ) {}
}

class Bucket {
  head: Node | null = null
  tail: Node | null = null

  get empty(): boolean {
    return this.head === null
  }

  append(node: Node): void {
    node.prev = this.tail
    node.next = null

    if (this.tail === null) this.head = node
    else this.tail.next = node
    this.tail = node
  }

  detach(node: Node): void {
    if (node.prev === null) this.head = node.next
    else node.prev.next = node.next

    if (node.next === null) this.tail = node.prev
    else node.next.prev = node.prev

    node.prev = null
    node.next = null
  }
}

class ListBucketQueue {
  private nodes = new Map<number, Node>()
  private buckets: Bucket[] = [new Bucket()]
  private minFreq = 1

  get size(): number {
    return this.nodes.size
  }

  get(key: number): Node | undefined {
    return this.nodes.get(key)
  }

  insert(key: number, value: number): void {
    const node = new Node(key, value, 1)
    this.nodes.set(key, node)
    this.buckets[0].append(node)
    this.minFreq = 1
  }

  touch(node: Node): void {
    const bucket = this.buckets[node.freq - 1]
    bucket.detach(node)
    if (bucket.empty && this.minFreq === node.freq) {
      this.minFreq += 1
    }

    node.freq += 1
    if (this.buckets.length < node.freq) this.buckets.push(new Bucket())
    this.buckets[node.freq - 1].append(node)
  }

  evict(): void {
    const bucket = this.buckets[this.minFreq - 1]
    const victim = bucket.head!
    bucket.detach(victim)
    this.nodes.delete(victim.key)
  }
}

class LFUCache {
  private queue = new ListBucketQueue()

  constructor(private capacity: number) {}

  get(key: number): number {
    const node = this.queue.get(key)
    if (node === undefined) return -1

    this.queue.touch(node)
    return node.value
  }

  put(key: number, value: number): void {
    if (this.capacity === 0) return

    const node = this.queue.get(key)
    if (node !== undefined) {
      node.value = value
      this.queue.touch(node)
      return
    }

    if (this.queue.size === this.capacity) this.queue.evict()
    this.queue.insert(key, value)
  }
}
```

Each bucket is a doubly linked list with a head and tail pointer. Adding an
element to a frequency group inserts it at the end, indicating "most recent",
and evicting an element removes the head of the bucket.

This works and passes the Leetcode test cases. Even in languages with manual
memory management, handling the (de)allocation and ownership of linked list
nodes isn't too bad with [arenas](/blog/arena) or
[slotmaps](https://docs.rs/slotmap/latest/slotmap/), so this is a viable option
when ordering matters.

On the other hand, look at all the extra machinery introduced just for the
ordering. Remember that the source code above doesn't contain deletion! Doubly
linked list operations are finicky and error-prone: just look at the number of
null checks in the code. We also lost the free sorted entries and must maintain
the minimum frequency explicitly.

# Conclusion

So this is the frequency queue data structure. By taking advantage of a very
restrictive operation set (increase and decrease the frequency by 1), we
managed to implement a data structure asymptotically more efficient than a
general-purpose priority queue. Depending on whether you need insertion order
preservation, there are two choices:

- The flat array layout
- The doubly linked list buckets layout

But I'd argue that the insertion order preservation is just an arbitrary
constraint that the Leetcode problem gave us as a tie-breaking criterion. Most
of the time, the element order doesn't really matter and you're better off with
the flat array layout. It lets you skip all headache-inducing doubly linked
list manipulation, simplifies memory management, and gives you the frequency-
sorted array for free.

The flat-array-based frequency queue replaced the binary heap in my BPE
encoder. This resulted in 2.5x faster encoding, as expected with the time
complexity reduction. I can already see more algorithms where it may be
applicable, e.g. Huffman coding. Now whenever I feel like reaching out for a
priority queue, I'll try and see if it's possible to reformulate the priority
as frequency/count to see if it's possible to use this. In a sense, this has
become my default implementation of the priority queue.

When choosing and designing data structures, consider what you really need and
what you can live without. The more guarantees you can make about your
problem and data, the more you can afford to give away to trade for better
performance and implementation simplicity.

