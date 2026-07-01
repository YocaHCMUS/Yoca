import { describe, expect, it } from "vitest";
import { pickResolvedValue } from "@sv/services/chat/chat-tool-normalizer.js";

describe("pickResolvedValue", () => {
  it("returns undefined for null/undefined data", () => {
    expect(pickResolvedValue(null, "first.address")).toBeUndefined();
    expect(pickResolvedValue(undefined, "first.address")).toBeUndefined();
  });

  it("navigates flat array with 'first' keyword", () => {
    const data = [{ address: "abc" }];
    expect(pickResolvedValue(data, "first.address")).toBe("abc");
  });

  it("navigates flat array with bracket index [0]", () => {
    const data = [{ address: "abc" }];
    expect(pickResolvedValue(data, "[0].address")).toBe("abc");
  });

  it("navigates nested object with bracket notation tokens[0]", () => {
    const data = { tokens: [{ address: "abc" }] };
    expect(pickResolvedValue(data, "tokens[0].address")).toBe("abc");
  });

  it("navigates nested with tokens[first].address", () => {
    const data = { tokens: [{ address: "abc" }] };
    expect(pickResolvedValue(data, "tokens[first].address")).toBe("abc");
  });

  it("handles deep nesting with bracket notation", () => {
    const data = { data: { items: [{ name: "a" }, { name: "b" }, { name: "c" }] } };
    expect(pickResolvedValue(data, "data.items[2].name")).toBe("c");
  });

  it("returns undefined for out-of-bounds index", () => {
    const data = { tokens: [{ address: "abc" }] };
    expect(pickResolvedValue(data, "tokens[999].address")).toBeUndefined();
  });

  it("returns undefined when bracket target is not an array", () => {
    const data = { foo: "bar" };
    expect(pickResolvedValue(data, "[0].address")).toBeUndefined();
  });

  it("returns undefined when navigating through non-object", () => {
    const data = [{ address: "abc" }];
    expect(pickResolvedValue(data, "first.address.missing")).toBeUndefined();
  });

  it("returns plain key value", () => {
    const data = { name: "test" };
    expect(pickResolvedValue(data, "name")).toBe("test");
  });

  it("returns undefined for empty array with 'first'", () => {
    expect(pickResolvedValue([], "first.address")).toBeUndefined();
  });

  it("handles mixed bracket and dot parts", () => {
    const data = {
      result: {
        items: [
          { meta: { id: 42 } },
        ],
      },
    };
    expect(pickResolvedValue(data, "result.items[0].meta.id")).toBe(42);
  });

  it("returns undefined for out-of-bounds on flat array with [0]", () => {
    expect(pickResolvedValue([], "[0].address")).toBeUndefined();
  });

  it("handles nested bracket with object key and array", () => {
    const data = { list: [{ x: 1 }, { x: 2 }] };
    expect(pickResolvedValue(data, "list[1].x")).toBe(2);
  });
});
